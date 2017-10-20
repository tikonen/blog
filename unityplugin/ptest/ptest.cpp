#include <IUnityInterface.h>

#include <Windows.h>
#include <string.h>

extern "C" {

#define PLUGINEX(rtype) UNITY_INTERFACE_EXPORT rtype UNITY_INTERFACE_API

	PLUGINEX(int) ReturnInt()
	{
		return 0xBABE;
	}

	PLUGINEX(void) AcceptArray1(char *arr, int length)
	{
		for (int i = 0; i < length; i++) {
			arr[i] = 'A' + i;
		}
	}

	PLUGINEX(void) AcceptArray2(char *arr, int length)
	{
		for (int i = 0; i < length; i++) {
			arr[i] = 'A' + i;
		}
	}

	PLUGINEX(bool) AcceptStr(LPCSTR pStr)
	{
		return !strcmp(pStr, "FOO");
	}

	PLUGINEX(int) AcceptStrArray(const char* const *strArray, int size)
	{
		int total = 0;
		for (int i = 0; i < size; i++) {
			auto str = strArray[i];
			total += (int)strlen(str);
		}
		// return total length of the strings in the array to demonstrate that
		// it was passed correctly
		return total;
	}

	PLUGINEX(LPSTR) ReturnDynamicStr()
	{		
		LPSTR str = (LPSTR)CoTaskMemAlloc(512);
		strcpy_s(str, 512, "Dynamic string");
		return str;
	}

	PLUGINEX(LPCSTR) ReturnConstStr()
	{		
		return "Constant string";
	}

	PLUGINEX(LPBYTE) ReturnDynamicByteArray(int &pSize)
	{
		pSize = 0xFF;
		LPBYTE pData = (LPBYTE)CoTaskMemAlloc(pSize);

		// fill with example data
		for (int i = 0; i < pSize; i++) {
			pData[i] = i + 1;
		}

		return pData;
	}

	PLUGINEX(LPSTR*) ReturnDynamicStrArray(int &pSize)
	{
		// Allocate an array with pointers to 3 dynamically allocated strings
		pSize = 3;
		LPSTR* pData = (LPSTR*)CoTaskMemAlloc((pSize)*sizeof(LPSTR));		
		pData[0] = (LPSTR)CoTaskMemAlloc(128);
		pData[1] = (LPSTR)CoTaskMemAlloc(128);
		pData[2] = (LPSTR)CoTaskMemAlloc(128);

		strcpy_s(pData[0], 128, "String 1");
		strcpy_s(pData[1], 128, "String 2");
		strcpy_s(pData[2], 128, "String 3");

		return pData;
	}

	struct ExampleStruct {
		INT16 val1;
		INT32 array1[3];
		INT16 array2len;
		INT32 array2[10];
		LPSTR str1;
	};

	PLUGINEX(int) AcceptStruct(ExampleStruct &s)
	{
		// Modify struct
		s.val1 -= 1111;
		for (int i= 0; i < 3; i++) {
			s.array1[i] += 1;			
		}
		for (int i = 0; i < s.array2len; i++) {
			s.array2[i] += 10;
		}
		// return length of the string in the argument struct to demonstrate that
		// it was passed correctly
		return (int)strlen(s.str1);
	}

	struct ExamplePoint {
		FLOAT x;
		FLOAT y;
		FLOAT z;
	};

	PLUGINEX(ExamplePoint *) ReturnArrayOfPoints(int &size)
	{
		size = 4;
		ExamplePoint *pointArr = (ExamplePoint*)CoTaskMemAlloc(sizeof(ExamplePoint) * size);

		// fill with some example data
		for (int i = 0; i < size; i++) {
			pointArr[i] = { i + 0.1f, i + 0.2f, i + 0.3f };
		}
		return pointArr;
	}

	// this return type is blittable
	// https://stackoverflow.com/questions/10320502/c-sharp-calling-c-function-that-returns-struct-with-fixed-size-char-array
	//
	PLUGINEX(ExamplePoint) ReturnStruct()
	{		
		return { 1, 2, 3 };
	}
}
