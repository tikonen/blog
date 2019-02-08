// open.cpp : Defines the entry point for the console application.
//

#include "stdafx.h"


void usage()
{
	wprintf(L"Opens files with the Windows default action.\n\n");
	wprintf(L"open -e [filename1] [filename2] ...\n\n");
	wprintf(L"  -e\tOpen in default editor\n");
	wprintf(L"  -h\tThis help\n\n");
	exit(0);
}

int wmain(int argc, wchar_t *argv[])
{
	if (argc <= 1) {
		usage();
	}
	CoInitializeEx(NULL, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);

	bool edit = false;
	for (int i = 1; i < argc; i++) {
		if (!lstrcmpiW(argv[i], L"/?") || !lstrcmpW(argv[i], L"-h")) {
			usage();
		}
		if (!lstrcmpiW(argv[i], L"/E") || !lstrcmpW(argv[i], L"-e")) {
			edit = true;
			continue;
		}
		int err = 0;
		if (!edit) {
			err = reinterpret_cast<int>(ShellExecute(NULL, NULL, argv[i], NULL, NULL, SW_SHOWNORMAL));
			//int err = reinterpret_cast<int>(ShellExecute(NULL, L"open", argv[i], NULL, NULL, SW_SHOWNORMAL));
		}		
		if (err == SE_ERR_NOASSOC || edit) {
			err = reinterpret_cast<int>(ShellExecute(NULL, L"edit", argv[i], NULL, NULL, SW_SHOWNORMAL));
		}
		
		// If the function succeeds, it returns a value greater than 32. If the function fails, 
		// it returns an error value that indicates the cause of the failure. 
		// The return value is cast as an HINSTANCE for backward compatibility with 16-bit Windows applications. 
		// It is not a true HINSTANCE, however. It can be cast only to an int and compared to either 32 or
		// the following error codes below.		
		if (err <= 32) {			
			if (err == ERROR_FILE_NOT_FOUND) {
				wprintf(L"file '%s' not found\n", argv[i]);
			} else {
				wprintf(L"unable to open '%s'. error 0x%x\n", argv[i], err);
			}
		}
	}
    return 0;
}

