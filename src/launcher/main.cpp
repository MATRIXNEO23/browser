#define UNICODE
#define _UNICODE
#include <windows.h>
#include <filesystem>
#include <string>
#include <vector>
#include <cwctype>

namespace fs = std::filesystem;

enum : int {
    ID_NORMAL = 101,
    ID_TURBO = 102,
    ID_PRIVATE = 103,
    ID_GHOST = 104
};

static std::wstring g_selectedMode;
static HBRUSH g_backgroundBrush = nullptr;

static std::wstring Quote(const std::wstring& value) {
    return L"\"" + value + L"\"";
}

static bool IsValidMode(const std::wstring& mode) {
    return mode == L"NORMAL" || mode == L"TURBO" ||
           mode == L"PRIVATE" || mode == L"GHOST";
}

static std::wstring ReadModeArgument(int argc, wchar_t** argv) {
    for (int i = 1; i + 1 < argc; ++i) {
        if (std::wstring(argv[i]) == L"--mode") {
            std::wstring mode = argv[i + 1];
            if (IsValidMode(mode)) return mode;
        }
    }
    return L"";
}

static LRESULT CALLBACK SelectorProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            CreateWindowW(L"STATIC", L"Scegli modalità",
                WS_CHILD | WS_VISIBLE,
                24, 18, 250, 24, hwnd, nullptr, nullptr, nullptr);

            CreateWindowW(L"BUTTON", L"NORMAL",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                24, 56, 118, 36, hwnd, (HMENU)ID_NORMAL, nullptr, nullptr);

            CreateWindowW(L"BUTTON", L"TURBO",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                154, 56, 118, 36, hwnd, (HMENU)ID_TURBO, nullptr, nullptr);

            CreateWindowW(L"BUTTON", L"PRIVATE",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                24, 104, 118, 36, hwnd, (HMENU)ID_PRIVATE, nullptr, nullptr);

            CreateWindowW(L"BUTTON", L"GHOST",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                154, 104, 118, 36, hwnd, (HMENU)ID_GHOST, nullptr, nullptr);

            CreateWindowW(L"STATIC",
                L"NORMAL mantiene sessione e cronologia.\nTURBO riduce carico. PRIVATE e GHOST aumentano isolamento.",
                WS_CHILD | WS_VISIBLE,
                24, 154, 248, 52, hwnd, nullptr, nullptr, nullptr);
            return 0;
        }

        case WM_COMMAND:
            switch (LOWORD(wParam)) {
                case ID_NORMAL:  g_selectedMode = L"NORMAL"; break;
                case ID_TURBO:   g_selectedMode = L"TURBO"; break;
                case ID_PRIVATE: g_selectedMode = L"PRIVATE"; break;
                case ID_GHOST:   g_selectedMode = L"GHOST"; break;
                default: return 0;
            }
            DestroyWindow(hwnd);
            return 0;

        case WM_CTLCOLORSTATIC: {
            HDC hdc = (HDC)wParam;
            SetTextColor(hdc, RGB(235, 235, 235));
            SetBkColor(hdc, RGB(24, 24, 24));
            return (LRESULT)g_backgroundBrush;
        }

        case WM_CLOSE:
            DestroyWindow(hwnd);
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static std::wstring ShowModeSelector(HINSTANCE instance) {
    g_selectedMode.clear();
    g_backgroundBrush = CreateSolidBrush(RGB(24, 24, 24));

    const wchar_t* className = L"MatrixNeoBrowserModeSelector";
    WNDCLASSW wc{};
    wc.lpfnWndProc = SelectorProc;
    wc.hInstance = instance;
    wc.lpszClassName = className;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground = g_backgroundBrush;
    RegisterClassW(&wc);

    const int width = 312;
    const int height = 255;
    const int x = (GetSystemMetrics(SM_CXSCREEN) - width) / 2;
    const int y = (GetSystemMetrics(SM_CYSCREEN) - height) / 2;

    HWND hwnd = CreateWindowExW(
        WS_EX_APPWINDOW,
        className,
        L"Browser",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
        x, y, width, height,
        nullptr, nullptr, instance, nullptr
    );

    if (!hwnd) {
        DeleteObject(g_backgroundBrush);
        g_backgroundBrush = nullptr;
        return L"NORMAL";
    }

    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);

    MSG msg{};
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (g_backgroundBrush) {
        DeleteObject(g_backgroundBrush);
        g_backgroundBrush = nullptr;
    }

    return g_selectedMode;
}

static int LaunchBrowser(const fs::path& root, const std::wstring& mode) {
    fs::path firefox = root / L"runtime" / L"firefox" / L"firefox.exe";
    if (!fs::exists(firefox)) {
        MessageBoxW(nullptr,
                    L"Runtime Gecko/Firefox non trovato in runtime\\firefox.",
                    L"Browser",
                    MB_OK | MB_ICONERROR);
        return 11;
    }

    std::wstring profileName = mode;
    for (auto& c : profileName) c = (wchar_t)towlower(c);

    fs::path profile = root / L"profiles" / profileName;
    std::error_code ec;
    fs::create_directories(profile, ec);

    std::wstring command =
        Quote(firefox.wstring()) +
        L" -no-remote -new-instance -profile " +
        Quote(profile.wstring());

    STARTUPINFOW si{};
    PROCESS_INFORMATION pi{};
    si.cb = sizeof(si);

    std::vector<wchar_t> mutableCommand(command.begin(), command.end());
    mutableCommand.push_back(L'\0');

    BOOL ok = CreateProcessW(
        firefox.c_str(),
        mutableCommand.data(),
        nullptr,
        nullptr,
        FALSE,
        0,
        nullptr,
        root.c_str(),
        &si,
        &pi
    );

    if (!ok) {
        MessageBoxW(nullptr,
                    L"Impossibile avviare il runtime del browser.",
                    L"Browser",
                    MB_OK | MB_ICONERROR);
        return 12;
    }

    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return 0;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);

    std::wstring mode;
    if (argv) {
        mode = ReadModeArgument(argc, argv);
        LocalFree(argv);
    }

    if (mode.empty()) {
        mode = ShowModeSelector(instance);
        if (mode.empty()) return 0;
    }

    wchar_t modulePath[MAX_PATH] = {};
    if (!GetModuleFileNameW(nullptr, modulePath, MAX_PATH)) return 10;

    fs::path root = fs::path(modulePath).parent_path();
    return LaunchBrowser(root, mode);
}
