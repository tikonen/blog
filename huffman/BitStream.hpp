#pragma once

#include <vector>

class BitStreamReader
{
public:
	BitStreamReader(const unsigned char *data, size_t size)
	    : m_Data(data)
	    , m_Size(size)
	    , m_In(0)
	    , m_Pos(0)
	    , m_BitCount(0)
	{
	}

	bool Read(uint32_t &value, int bitLen)
	{
		value = 0;

		// loop until requested number of bits have been processed
		do {
			if (m_BitCount == 0) {
				if (m_Pos + 1 > m_Size) {
					return false;
				}
				m_In = m_Data[m_Pos++];
				m_BitCount = CHAR_BIT;
			}
			int shift = std::min(m_BitCount, bitLen);
			value <<= shift;
			value |= m_In >> (m_BitCount - shift);
			m_BitCount -= shift;

			// clear copied bits
			bitLen -= shift;
			if (m_BitCount) {
				m_In &= (1 << m_BitCount) - 1;
			}
		} while (bitLen);

		return true;
	}

	size_t Pos() const { return m_Pos; }

protected:
	size_t m_Pos;
	unsigned char m_In;
	int m_BitCount;
	const unsigned char *m_Data;
	size_t m_Size;
};

class BitStreamWriter
{
public:
	BitStreamWriter(size_t reserve)
	    : m_TotalBitCount(0)
	    , m_Out(0)
	    , m_BitCount(CHAR_BIT * sizeof(m_Out))
	{
		m_Data.reserve(reserve);
	}

	void Write(DWORD value, int bitLen)
	{
		m_TotalBitCount += bitLen;

		// loop while code bits have been copied out
		do {
			// copy code bits to the encoded byte chunk
			int shift = std::min(m_BitCount, bitLen);
			m_Out <<= shift;
			m_Out |= value >> (bitLen - shift);
			m_BitCount -= shift;

			if (m_BitCount == 0) {
				// encoded chunk is completed, write out
				size_t pos = m_Data.size();
				m_Data.resize(pos + sizeof(m_Out));
				m_Out = _byteswap_ulong(m_Out);
				memcpy(&m_Data[pos], &m_Out, sizeof(m_Out));  // compiler will optimize this to a single instruction

				// start a new one
				m_BitCount = CHAR_BIT * sizeof(m_Out);
			}
			// clear copied bits from the code
			bitLen -= shift;
			if (bitLen) {
				value &= (1ll << bitLen) - 1ll;
				// code &= (1 << len) - 1;
			}
		} while (bitLen);
	}

	void Close()
	{
		if (m_BitCount != CHAR_BIT * sizeof(m_Out)) {
			// Write out remaining partially encoded bytes
			m_Out <<= m_BitCount;
			size_t pos = m_Data.size();
			int size = sizeof(m_Out) - m_BitCount / 8;
			m_Data.resize(pos + size);
			// Loop is lot faster than byteswapping first and then memcpy.
			for (int i = 0; i < size; i++) {
				m_Data[pos + i] = ((unsigned char *)&m_Out)[3 - i];
			}
		}
	}

	unsigned int Count() const { return m_TotalBitCount; }
	std::vector<unsigned char> &Data() { return m_Data; }

protected:
	uint32_t m_Out;
	unsigned int m_TotalBitCount;
	int m_BitCount;
	std::vector<unsigned char> m_Data;
};
