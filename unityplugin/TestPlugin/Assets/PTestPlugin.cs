using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System.Runtime.InteropServices;
using System;

class PTestPlugin : MonoBehaviour
{
    [DllImport("ptest")]
    private static extern int ReturnInt();

    [DllImport("ptest")]
    private static extern void AcceptArray1([In, Out] byte[] arr, int length);

    [DllImport("ptest")]
    private static extern void AcceptArray2(IntPtr arr, int length);

    [DllImport("ptest")]
    private static extern bool AcceptStr([MarshalAs(UnmanagedType.LPStr)] string ansiStr);

    [DllImport("ptest")]
    private static extern int AcceptStrArray(IntPtr array, int size);

    // automatically deallocates the return string with CoTaskMemFree
    [DllImport("ptest")]
    [return: MarshalAs(UnmanagedType.LPStr)]
    private static extern string ReturnDynamicStr();

    [DllImport("ptest")]
    private static extern IntPtr ReturnConstStr();

    [DllImport("ptest")]
    private static extern IntPtr ReturnDynamicByteArray(ref int size);

    [DllImport("ptest")]
    private static extern IntPtr ReturnDynamicStrArray(ref int size);

    [StructLayout(LayoutKind.Sequential)]
    public struct ExamplePoint
    {
        public float x;
        public float y;
        public float z;

        // for debugging
        public override String ToString()
        {
            return "{" + x + ","+ y + "," + z + "}";
        }
    }

    [DllImport("ptest")]
    private static extern IntPtr ReturnArrayOfPoints(ref int size);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct ExampleStruct
    {
        public UInt16 val1;
        [MarshalAsAttribute(UnmanagedType.ByValArray, SizeConst = 3)]
        public UInt32[] array1;
        public UInt16 array2len;
        [MarshalAsAttribute(UnmanagedType.ByValArray, SizeConst = 10)]
        public UInt32[] array2;
        [MarshalAs(UnmanagedType.LPStr)]
        public string str1;
    }

    [DllImport("ptest")]
    private static extern int AcceptStruct(ref ExampleStruct s);

    [DllImport("ptest")]
    private static extern ExamplePoint ReturnStruct();

    private static IntPtr MarshalStringArray(string[] strArr)
    {
        IntPtr[] dataArr = new IntPtr[strArr.Length];
        for (int i = 0; i < strArr.Length; i++)
        {
            dataArr[i] = Marshal.StringToCoTaskMemAnsi(strArr[i]);
        }
        IntPtr dataNative = Marshal.AllocCoTaskMem(Marshal.SizeOf(typeof(IntPtr)) * strArr.Length);
        Marshal.Copy(dataArr, 0, dataNative, dataArr.Length);

        return dataNative;
    }
    private static string[] MarshalStringArray(IntPtr dataPtr, int arraySize)
    {
        var dataPtrArray = new IntPtr[arraySize];
        var strArray = new String[arraySize];
        Marshal.Copy(dataPtr, dataPtrArray, 0, arraySize);
        for (int i = 0; i < arraySize; i++)
        {
            strArray[i] = Marshal.PtrToStringAnsi(dataPtrArray[i]);
            Marshal.FreeCoTaskMem(dataPtrArray[i]);
        }
        Marshal.FreeCoTaskMem(dataPtr);
        return strArray;
    }

    private static void CleanUpNativeStrArray(IntPtr dataPtr, int arraySize)
    {
        var dataPtrArray = new IntPtr[arraySize];
        Marshal.Copy(dataPtr, dataPtrArray, 0, arraySize);
        for (int i = 0; i < arraySize; i++)
        {
            Marshal.FreeCoTaskMem(dataPtrArray[i]);
        }
        Marshal.FreeCoTaskMem(dataPtr);
    }

    // Test functions
    private void Awake()
    {
        // return int
        print(ReturnInt());

        // accept string
        bool r1 = AcceptStr("BAR");
        bool r2 = AcceptStr("FOO");
        print("r1=" + r1);
        print("r2=" + r2);

        // accept byte array, uses marshalling to pass array back and forth
        byte[] arr1 = { 0, 0, 0 };
        AcceptArray1(arr1, arr1.Length);
        for (int i = 0; i < arr1.Length; i++)
        {
            print("arr" + i + "=" + arr1[i]);
        }

        // accept byte array, passes no-copy raw memory pointer
        byte[] arr2 = { 0, 0, 0 };
        GCHandle h = GCHandle.Alloc(arr2, GCHandleType.Pinned);
        AcceptArray2(h.AddrOfPinnedObject(), arr2.Length);
        for (int i = 0; i < arr2.Length; i++)
        {
            print("arr" + i + "=" + arr2[i]);
        }
        h.Free();

        // return dynamically allocated string
        string s1 = ReturnDynamicStr();
        print("s1=" + s1);

        // return constant string
        string s2 = Marshal.PtrToStringAnsi(ReturnConstStr());
        print("s2=" + s2);

        // return dynamically allocated byte array
        int arraySize = 0;
        IntPtr dataPtr = ReturnDynamicByteArray(ref arraySize);
        byte[] data = new byte[arraySize];
        Marshal.Copy(dataPtr, data, 0, arraySize);
        Marshal.FreeCoTaskMem(dataPtr); // deallocate unmanaged memory
        print("data["+arraySize+"] = [" + data[0] + ", " + data[1] + ", " + data[2] + ",...]");

        // return dynamically allocated string array
        arraySize = 0;
        dataPtr = ReturnDynamicStrArray(ref arraySize);
        String[] strArray = MarshalStringArray(dataPtr, arraySize);
        print("strArray["+arraySize+"] = [" + String.Join(",", strArray) + "]");

        // string array as parameter
        dataPtr = MarshalStringArray(new String[] { "foo1", "foo2", "foo3" });
        int len = AcceptStrArray(dataPtr, arraySize);
        print("len=" + len);
        CleanUpNativeStrArray(dataPtr, arraySize);
        //strArray = MarshalStringArray(dataPtr, 3);

        // Structure as parameter
        ExampleStruct s = new ExampleStruct
        {
            val1 = 9999,
            array1 = new UInt32[3],
            array2 = new UInt32[10]
        };
        s.array1[0] = 1;
        s.array1[1] = 2;
        s.array1[2] = 3;
        s.array2len = 5;
        s.array2[0] = 10;
        s.array2[1] = 11;
        s.array2[2] = 12;
        s.array2[3] = 13;
        s.array2[4] = 14;
        s.str1 = "Cat is a feline";

        len = AcceptStruct(ref s);
        print("s.val1=" + s.val1 + " len=" + len);

        // return struct
        ExamplePoint p = ReturnStruct();

        // Marshal array of point objects
        arraySize = 0;
        dataPtr = ReturnArrayOfPoints(ref arraySize);
        ExamplePoint[] pointArr = new ExamplePoint[arraySize];

        // memory layout
        // |float|float|float|float|float|float|float|float|float|float..
        // |   ExamplePoint0 |   ExamplePoint1 |   ExamplePoint2 |
        int offset = 0;
        int pointSize = Marshal.SizeOf(typeof(ExamplePoint));
        for(int i=0; i < arraySize; i++)
        {
            pointArr[i] = (ExamplePoint)Marshal.PtrToStructure(new IntPtr(dataPtr.ToInt32() + offset), typeof(ExamplePoint));
            offset += pointSize;
        }
        print("pointArr["+arraySize+"]=["+pointArr[0]+", "+pointArr[1]+",...]");
        Marshal.FreeCoTaskMem(dataPtr);

        print("Done!");
    }
}
