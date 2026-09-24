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

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    wchar_t modulePath[MAX_PATH] = {};
    if (!GetModuleFileNameW(nullptr, modulePath, MAX_PATH)) {
        return 10;
    }

    const fs::path root = fs::path(modulePath).parent_path();
    const fs::path runtime = root / L"runtime" / L"firefox" / L"firefox.exe";
    const fs::path profile = root / L"profile";

    if (!fs::exists(runtime)) {
        MessageBoxW(
            nullptr,
            L"Runtime del browser non trovato in runtime\\firefox.",
            L"Browser",
            MB_OK | MB_ICONERROR
        );
        return 11;
    }

    std::error_code ec;
    fs::create_directories(profile, ec);

    std::wstring command =
        Quote(runtime.wstring()) +
        L" -no-remote -new-instance -profile " +
        Quote(profile.wstring());

    STARTUPINFOW si{};
    PROCESS_INFORMATION pi{};
    si.cb = sizeof(si);

    std::vector<wchar_t> mutableCommand(command.begin(), command.end());
    mutableCommand.push_back(L'\0');

    const BOOL ok = CreateProcessW(
        runtime.c_str(),
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
        MessageBoxW(
            nullptr,
            L"Impossibile avviare il browser.",
            L"Browser",
            MB_OK | MB_ICONERROR
        );
        return 12;
    }

    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return 0;
}
