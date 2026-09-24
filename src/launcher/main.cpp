#define UNICODE
#define _UNICODE
#include <windows.h>
#include <filesystem>
#include <string>
#include <vector>

namespace fs = std::filesystem;

static std::wstring Quote(const std::wstring& value) {
    return L"\"" + value + L"\"";
}

static std::wstring ReadMode(int argc, wchar_t** argv) {
    for (int i = 1; i + 1 < argc; ++i) {
        if (std::wstring(argv[i]) == L"--mode") {
            std::wstring mode = argv[i + 1];
            if (mode == L"NORMAL" || mode == L"TURBO" ||
                mode == L"PRIVATE" || mode == L"GHOST") {
                return mode;
            }
        }
    }
    return L"NORMAL";
}

int wmain(int argc, wchar_t** argv) {
    wchar_t modulePath[MAX_PATH] = {};
    if (!GetModuleFileNameW(nullptr, modulePath, MAX_PATH)) {
        return 10;
    }

    fs::path root = fs::path(modulePath).parent_path();
    fs::path firefox = root / L"runtime" / L"firefox" / L"firefox.exe";
    if (!fs::exists(firefox)) {
        MessageBoxW(nullptr,
                    L"Runtime Gecko/Firefox non trovato in runtime\\firefox.",
                    L"Browser",
                    MB_OK | MB_ICONERROR);
        return 11;
    }

    std::wstring mode = ReadMode(argc, argv);
    std::wstring profileName = mode;
    for (auto& c : profileName) c = towlower(c);

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
