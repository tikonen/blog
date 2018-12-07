
#include <array>
#include <climits>
#include <functional>
#include <limits>
#include <queue>
#include <vector>

class HuffmanBase
{
public:
	struct HuffmanCode {
		// For a maximum code length of X bits, worst case requires 2*(1-2^X)/(1 - 2) byte data input. (assuming all 256 distinct byte values are present in the
		// data).
		uint32_t Code;
		uint8_t Len;
	};

	static void SerializeCodes(std::vector<unsigned char> &dataOut, const std::array<HuffmanCode, 256> &codeTable, bool pack);
	static bool DeSerializeCodes(const unsigned char *data, size_t size, size_t &pos, std::array<HuffmanCode, 256> &codeTable, bool packed);

	const std::array<HuffmanCode, 256> &GetTable() const { return m_CodeTable; }

protected:
	std::array<HuffmanCode, 256> m_CodeTable;
};

inline bool operator==(const HuffmanBase::HuffmanCode &c1, const HuffmanBase::HuffmanCode &c2) { return c1.Code == c2.Code && c1.Len == c2.Len; }

class HuffmanDecoder : public HuffmanBase
{
public:
	bool Initialize(std::array<HuffmanCode, 256> codes);
	bool DecodeData(unsigned char *pSrc, size_t size, size_t decodedSize, std::vector<unsigned char> &data);

protected:
	struct DecodeNode {
		int Value;
		DecodeNode *pLeft;
		DecodeNode *pRight;

		DecodeNode()
		    : Value(-1)
		    , pLeft(nullptr)
		    , pRight(nullptr)
		{
		}

		inline bool Leaf() const { return Value != -1; }
	};

	std::array<DecodeNode, 512> m_DecodeTree;

	bool BuildDecodeTree();
};

class HuffmanEncoder : public HuffmanBase
{
public:
	bool Initialize(std::array<HuffmanCode, 256> codes);
	bool EncodeData(const unsigned char *pSrc, unsigned int size, std::vector<unsigned char> &data);
	static std::array<unsigned int, 256> Histogram(unsigned char *pSrc, unsigned int size);
	static std::array<HuffmanCode, 256> BuildCodes(std::array<unsigned int, 256> &histogram, bool complete);

protected:
};
