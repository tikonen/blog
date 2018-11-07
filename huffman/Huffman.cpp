#include <windows.h>

#include <assert.h>

#undef max
#undef min

#include <algorithm>

#include "BitStream.hpp"
#include "Huffman.hpp"


void HuffmanBase::SerializeCodes(std::vector<unsigned char> &dataOut, const std::array<HuffmanCode, 256> &codeTable, bool pack)
{
	if (pack) {
		BitStreamWriter writer(512);
		for (size_t i = 0; i < codeTable.size(); i++) {
			const HuffmanCode &code = codeTable[i];
			assert(code.Len < (1 << 6));  // can use only 5 bits, maximum code length is 31
			writer.Write(code.Len, 5);
			writer.Write(code.Code, code.Len);
		}
		writer.Close();
		auto &data = writer.Data();
		dataOut.insert(dataOut.end(), data.begin(), data.end());
	} else {
		for (size_t i = 0; i < codeTable.size(); i++) {
			const HuffmanCode &code = codeTable[i];
			dataOut.emplace_back(code.Len);
			int codeLen = (code.Len + 7) / 8;  // round to number of bytes
			if (codeLen) {
				size_t pos = dataOut.size();
				dataOut.resize(pos + codeLen);
				memcpy(&dataOut[pos], &code.Code, codeLen);
			}
		}
	}
}

bool HuffmanBase::DeSerializeCodes(const unsigned char *data, size_t size, size_t &pos, std::array<HuffmanCode, 256> &codeTable, bool packed)
{
	if (packed) {
		BitStreamReader reader(data, size);
		for (int i = 0; i < codeTable.size(); i++) {
			uint32_t len;
			uint32_t code;
			if (reader.Read(len, 5) && reader.Read(code, len)) {
				codeTable[i] = {code, uint8_t(len)};
			} else {
				return false;
			}
		}
		pos = reader.Pos();

	} else {
		int idx = 0;

		for (pos = 0; pos < size && idx < codeTable.size();) {
			int len = data[pos++];
			uint32_t code = 0;
			int codeLen = (len + 7) / 8;  // round to number of bytes
			if (pos + codeLen > size) {
				return false;
			}
			if (codeLen) {
				memcpy(&code, &data[pos], codeLen);
				pos += codeLen;
			}

			codeTable[idx++] = {code, uint8_t(len)};
		}
	}
	return true;
}

void DumpCodecs(std::array<unsigned int, 256> &histogram, std::array<HuffmanBase::HuffmanCode, 256> &codeTable)
{
	// dump codecs
	for (int i = 0; i < 0xFF + 1; i++) {
		HuffmanBase::HuffmanCode &code = codeTable[i];
		if (code.Len) {
			printf("%02X (%d)\t", i, histogram[i]);
			for (int j = 0; j < code.Len; j++) {
				printf("%c", (code.Code >> (code.Len - j - 1)) & 1 ? '1' : '0');
			}
			printf("\n");
		}
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
// Decoder
//

bool HuffmanDecoder::Initialize(std::array<HuffmanCode, 256> codes)
{
	m_CodeTable = codes;
	return BuildDecodeTree();
}

bool HuffmanDecoder::DecodeData(unsigned char *pSrc, size_t size, size_t decodedSize, std::vector<unsigned char> &data)
{
	BYTE prev = 0;
	size_t i = 0;
	BYTE in = pSrc[i++];
	int bitCount = 0;
	DecodeNode *node = &m_DecodeTree[0];

	// allocate for output size
	data.reserve(data.size() + decodedSize);

	// loop until requested number of bytes have been decoded
	while (data.size() < decodedSize) {
		if (bitCount == CHAR_BIT) {
			if (i >= size) {
				// run out of input
				return false;
			}
			// encoded byte exhausted, get next one
			in = pSrc[i++];
			bitCount = 0;
		}
		if (node->Leaf()) {
			// write decoded byte out and start over
			data.emplace_back(prev = (BYTE)(node->Value + prev));
			node = &m_DecodeTree[0];
		} else {
			// traverse encoding tree
			if (0x80 & in) {
				node = node->pRight;
			} else {
				node = node->pLeft;
			}
			if (!node) {
				// probably corrupted data or wrong code table
				return false;
			}
			// bit is used
			in <<= 1;
			bitCount++;
		}
	}
	return true;
}


bool HuffmanDecoder::BuildDecodeTree()
{
	std::array<std::pair<HuffmanCode, int>, 256> codes;
	for (int i = 0; i < codes.size(); i++) {
		codes[i] = {m_CodeTable[i], i};
	}
	// sort
	std::sort(codes.begin(), codes.end(), [](const std::pair<HuffmanCode, int> &c1, const std::pair<HuffmanCode, int> &c2) -> bool {
		return c1.first.Len < c2.first.Len;
	});

	int allocationIdx = 0;
	DecodeNode *root = &m_DecodeTree[allocationIdx++];
	for (int i = 0; i < codes.size(); i++) {
		const HuffmanCode &code = codes[i].first;
		if (code.Len == 0) {
			continue;
		}
		DecodeNode *node = &m_DecodeTree[0];
		uint64_t c = code.Code;
		c <<= 64 - code.Len;
		for (int j = 0; j < code.Len; j++) {
			if (c & (1LL << 63)) {
				if (!node->pRight) {
					node->pRight = &m_DecodeTree[allocationIdx++];
				}
				node = node->pRight;
			} else {
				if (!node->pLeft) {
					node->pLeft = &m_DecodeTree[allocationIdx++];
				}
				node = node->pLeft;
			}
			c <<= 1;
		}
		if (node->Value != -1) {
			return false;
		}
		node->Value = codes[i].second;
	}
	return true;
}

///////////////////////////////////////////////////////////////////////////////
// Encoder
//

bool HuffmanEncoder::Initialize(std::array<HuffmanCode, 256> codes)
{
	m_CodeTable = codes;
	return true;
}

bool HuffmanEncoder::EncodeData(const BYTE *pSrc, unsigned int size, std::vector<BYTE> &data)
{
	BYTE prev = 0;
	DWORD out = 0;
	int bitCount = CHAR_BIT * sizeof(out);

	data.reserve(data.size() + size);  // worst case allocation

	for (unsigned int i = 0; i < size; i++) {
		// get the huffman code for the next byte
		const HuffmanCode &huff = m_CodeTable[(BYTE)(pSrc[i] - prev)];
		prev = pSrc[i];
		int len = huff.Len;
		uint32_t code = huff.Code;

		// loop while code bits have been copied out
		do {
			// copy code bits to the encoded byte chunk
			int shift = std::min(bitCount, len);
			out <<= shift;
			out |= code >> (len - shift);
			bitCount -= shift;

			if (bitCount == 0) {
				// encoded chunk is completed, write out
				size_t pos = data.size();
				data.resize(pos + sizeof(out));
				out = _byteswap_ulong(out);
				memcpy(&data[pos], &out, sizeof(out));  // compiler will optimize this to a single instruction

				// start a new one
				bitCount = CHAR_BIT * sizeof(out);
			}
			// clear copied bits from the code
			len -= shift;
			if (len) {
				code &= (1ll << len) - 1ll;
				// code &= (1 << len) - 1;
			}
		} while (len);
	}
	if (bitCount != CHAR_BIT * sizeof(out)) {
		// Write out remaining partially encoded bytes
		out <<= bitCount;
		size_t pos = data.size();
		int size = sizeof(out) - bitCount / 8;
		data.resize(pos + size);
		// Loop is lot faster than byteswapping first and then memcpy.
		for (int i = 0; i < size; i++) {
			data[pos + i] = ((BYTE *)&out)[3 - i];
		}
	}
	return true;
}

struct TreeNode {
	int Value;
	DWORD Freq;
	TreeNode *pLeft;
	TreeNode *pRight;

	TreeNode()
	    : Freq(0)
	    , Value(-1)
	    , pLeft(nullptr)
	    , pRight(nullptr)
	{
	}

	inline void MakeLeaf(DWORD freq, int value)
	{
		Freq = freq;
		Value = value;
	}

	inline void MakeBranch(TreeNode *left, TreeNode *right)
	{
		Freq = left->Freq + right->Freq;
		pLeft = left;
		pRight = right;
	}

	inline bool Leaf() const { return Value != -1; }
};

// Comparator for the heap operations
struct _TreeNodeCompare {
	bool operator()(const TreeNode *n1, const TreeNode *n2) const { return n1->Freq > n2->Freq; }
};


std::array<unsigned int, 256> HuffmanEncoder::Histogram(unsigned char *pSrc, unsigned int size)
{
	// compute histogram of the data
	BYTE prev = 0;
	std::array<unsigned int, 256> histogram{0};

	for (unsigned int i = 0; i < size; i++) {
		histogram[(BYTE)(pSrc[i] - prev)]++;
		prev = pSrc[i];
	}
	return histogram;
}

std::array<HuffmanEncoder::HuffmanCode, 256> HuffmanEncoder::BuildCodes(std::array<unsigned int, 256> &histogram, bool complete)
{
	std::array<HuffmanCode, 256> codeTable{0};
	std::array<TreeNode, 512> allocation;
	int allocationIdx = 0;

	/*
	namespace std
	{
	    // specialization for the heap operations
	    template <>
	    struct less<TreeNode *> {
	        bool operator()(const TreeNode *n1, const TreeNode *n2) const { return n1->Freq > n2->Freq; }
	    };
	}
	std::priority_queue<TreeNode *> heap;
	*/

	// auto _compare = [](const TreeNode *n1, const TreeNode *n2) { return n1->Freq > n2->Freq; };
	// std::priority_queue<TreeNode *, std::vector<TreeNode *>, decltype(_compare)> heap(_compare);


	// make heap
	std::priority_queue<TreeNode *, std::vector<TreeNode *>, _TreeNodeCompare> heap;
	for (int c = 0; c < histogram.size(); c++) {
		if (histogram[c] || complete) {
			TreeNode *n = &allocation[allocationIdx++];
			n->MakeLeaf(histogram[c] + complete, c);
			heap.push(n);
		} else {
			// some value is not here
		}
	}

	while (heap.size() > 1) {
		// get 2 smallest elements
		TreeNode *n1 = heap.top();
		heap.pop();
		TreeNode *n2 = heap.top();
		heap.pop();

		TreeNode *n = &allocation[allocationIdx++];
		n->MakeBranch(n1, n2);
		heap.push(n);
	}
	TreeNode *root = heap.top();

	// Tree traveller to build the codes
	std::function<void(BYTE, const TreeNode *, uint32_t)> Travel = [&](BYTE depth, const TreeNode *n, uint32_t c) {
		if (n->Leaf()) {
			HuffmanCode code{c, depth};
			codeTable[n->Value] = code;
		} else {
			assert(depth < CHAR_BIT * sizeof(c));  // max depth check

			Travel(depth + 1, n->pLeft, c << 1);
			Travel(depth + 1, n->pRight, (c << 1) | 1);
		}
	};

	// Travel the tree and create codes
	Travel(0, root, 0);

	// DumpCodecs(histogram, codeTable);
	return codeTable;
}


#include <chrono>

void TestEncoder()
{
	int dataSize = 1024 * 1024;
	BYTE *data = new BYTE[dataSize];

#if 0
	for (int i = 0; i < dataSize; i++) {
		data[i] = rand();
	}
#endif
#if 1
	int j = 0, k = 0;
	int size = dataSize;
	while (size) {
		for (int i = 0; i < size / 2; i++) {
			data[j++] = k;
		}
		k++;
		size /= 2;
	}
#endif

	auto histogram = HuffmanEncoder::Histogram(data, dataSize);
	auto codes = HuffmanEncoder::BuildCodes(histogram, false);

	HuffmanEncoder henc;
	henc.Initialize(codes);

	/*
	auto ser = henc.SerializeCodes(codes);
	size_t pos = 0;
	std::array<HuffmanBase::HuffmanCode, 256> codes2{ 0 };
	henc.DeSerializeCodes(ser, pos, codes2);
	*/


#if 0
	printf("Start\n");
	using namespace std::chrono;
	high_resolution_clock::time_point t1 = high_resolution_clock::now();
	for (int i = 0; i < 1000; i++) {
		// encode data
		std::vector<BYTE> enctmp;
		henc.EncodeData(data, dataSize, enctmp);
		enctmp.resize(0);
	}
	high_resolution_clock::time_point t2 = high_resolution_clock::now();
	duration<double> time_span = duration_cast<duration<double>>(t2 - t1);
	printf("Seconds %f\n", time_span.count());

	// Release. 319 fps (Debug. 28 fps)
	// Release. 378 fps. Check for an unnecessary shift
	// Release. 390 fps. Removed an unnecessary value reset to 0
	// Release. 409 fps. Removed sanity check
	// Release. 465 fps. Use 32bit encode size (Debug. 39 fps)
	// Release. 595 fps. Use AVX2 and other non-default compiler optimizations
	// Release. 610 fps. Use 32bit max code len

	while (true) {
	};
#endif
	std::vector<BYTE> enc;
	henc.EncodeData(data, dataSize, enc);

	/*
	{
	    HuffmanEncoder henc2;
	    auto codes2 = henc2.BuildCodes(enc.data(), enc.size(), false);
	    henc2.Initialize(codes2);
	    std::vector<BYTE> enc2;
	    henc2.EncodeData(enc.data(), enc.size(), enc2);
	}
	*/

	std::vector<BYTE> dec;

	HuffmanDecoder hdec;
	hdec.Initialize(henc.GetTable());

	hdec.DecodeData(enc.data(), enc.size(), dataSize, dec);

	auto m = std::mismatch(data, data + dataSize, dec.begin(), dec.end());

	if (m.first != data + dataSize || m.second != dec.end()) {
		printf("Decoding failed. %X != %X", *m.first, *m.second);
	}
}
