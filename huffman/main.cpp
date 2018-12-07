
#include <stdio.h>

#include <cstring>
#include <assert.h>
#include <cctype>
#include <fstream>
#include <string>
#include <vector>

#include "Huffman.hpp"

void DisplayUsage();
void CheckArgs(int argc, int required);
void Compress(std::vector<unsigned char> &dataIn, std::vector<unsigned char> &dataOut);
bool DeCompress(std::vector<unsigned char> &dataIn, std::vector<unsigned char> &dataOut);

#if defined(WIN32)
#define OPT_FLAG "/"
#else
#define OPT_FLAG "-"

const char GetLastError() {
	return errno;
}
#endif


int main(int argc, char *argv[])
{
	CheckArgs(argc, 2);

	argv++;
	argc--;

	const char *stream = 0;
	const char *outfile = 0;
	bool decompress = false;

	while (**argv == *OPT_FLAG) {
		const char *arg = *argv;
		arg++;
		if (!strcasecmp(arg, "d")) {
			decompress = true;
		} else
		/*
		if (!_strnicmp(arg, "s:", 2)) {
		    // scanf_s(arg, "/%*[a-zA-Z]=%s", filepath, MAX_PATH);
		    // scanf_s(arg, "/%*[a-zA-Z]=%d", i);
		    stream = arg + 2;
		    if (!stream) {
		        DisplayUsage();
		    }
		} else if (!_strnicmp(arg, "o:", 2)) {
		    outfile = arg + 2;
		} else if (!_stricmp(arg, "/h")) {
		    headers = true;
		} else*/
		{
			printf("ERROR: Invalid option %s\n\n", arg);
			DisplayUsage();
		}
		argv++;
		argc--;
	}
	CheckArgs(argc, 1);  // filename should be left

	const char *filename = *argv;
	std::ifstream in(filename, std::ios::binary);
	if (!in) {
		fprintf(stderr, "Cannot open file \"%s\". %d", filename, GetLastError());
		exit(1);
	}
	in.unsetf(std::ios::skipws);

	in.seekg(0, std::ios::end);
	auto size = in.tellg();
	in.seekg(0, std::ios::beg);

	std::vector<unsigned char> data(size);
	if (!in.read((char *)data.data(), size)) {
		fprintf(stderr, "Cannot read file \"%s\". %d", filename, GetLastError());
		exit(1);
	}
	std::vector<unsigned char> dataOut;
	if (decompress) {
		size_t originalSize = 0;
		if (!DeCompress(data, dataOut)) {
			fprintf(stderr, "Error decompressing \"%s\". File corrupted or not an valid archive.\n", filename);
			exit(1);
		}
	} else {
		Compress(data, dataOut);
	}

	std::string fileSuffix = "huff";

	std::string outfileName(filename);
	if (decompress) {
		// Remove possible compressed file suffix
		auto pos = outfileName.find_last_of(".");
		if (pos != std::string::npos) {
			auto suffix = outfileName.substr(pos + 1);
			std::transform(suffix.begin(), suffix.end(), suffix.begin(), ::tolower);
			if (suffix == fileSuffix) {
				outfileName = outfileName.substr(0, pos);
			}
		}
	} else {
		// Add compressed file suffix
		outfileName += ".";
		outfileName += fileSuffix;
	}

	std::ofstream out(outfileName, std::ios::binary);
	if (!out) {
		fprintf(stderr, "Cannot open output file \"%s\". %d", outfileName.c_str(), GetLastError());
		exit(1);
	}
	if (!out.write((char *)dataOut.data(), dataOut.size())) {
		fprintf(stderr, "Cannot write file \"%s\". %d", outfileName.c_str(), GetLastError());
		exit(1);
	}
	printf("%d -> %d\n", (int)size, (int)dataOut.size());
	float ratio = (float)size / dataOut.size();
	printf("%s -> %s %.2f Ratio\n", filename, outfileName.c_str(), decompress ? 1 / ratio : ratio);
}

bool DeCompress(std::vector<unsigned char> &dataIn, std::vector<unsigned char> &dataOut)
{
	unsigned char *pSrc = dataIn.data();
	size_t size = dataIn.size();

	// read table
	std::array<HuffmanBase::HuffmanCode, 256> codes;
	size_t pos;
	if (!HuffmanBase::DeSerializeCodes(pSrc, size, pos, codes, true)) {
		fprintf(stderr, "Premature end of file\n");
		return false;
	}

	HuffmanDecoder dec;
	if (!dec.Initialize(codes)) {
		fprintf(stderr, "File header corruption detected\n");
		return false;
	}

	// read byte count
	if (dataIn.size() < pos + 4) {
		fprintf(stderr, "Premature end of file\n");
		return false;
	}
	size_t decodedSize = 0;
	memcpy(&decodedSize, &dataIn[pos], 4);
	pos += 4;

	if (decodedSize > (1ll << 32)) {
		fprintf(stderr, "File size too large %zu\n", decodedSize);
		return false;
	}

	if (!dec.DecodeData(pSrc + pos, size - pos, decodedSize, dataOut)) {
		fprintf(stderr, "Premature end of file\n");
	}
	return true;
}


void Compress(std::vector<unsigned char> &dataIn, std::vector<unsigned char> &dataOut)
{
	unsigned char *pSrc = dataIn.data();
	unsigned int size = (unsigned int)dataIn.size();

	auto histogram = HuffmanEncoder::Histogram(pSrc, size);
	auto codes = HuffmanEncoder::BuildCodes(histogram, false);

	// insert huffman table
	HuffmanBase::SerializeCodes(dataOut, codes, true);

	// insert file size
	size_t pos = dataOut.size();
	dataOut.resize(pos + 4);
	memcpy(&dataOut[pos], &size, 4);

	HuffmanEncoder enc;
	enc.Initialize(codes);
	enc.EncodeData(pSrc, size, dataOut);
}

void CheckArgs(int argc, int required)
{
	if (argc < required) {
		printf("ERROR: Incorrect number of arguments\n\n");
		DisplayUsage();
	}
}

void DisplayUsage()
{
	printf("Description:\n");
	printf("\tCommand-line tool that compresses a file.\n\n");
	printf("Usage:\n");
	printf("\thuffc [options] file.dat\n\n");
	printf("\t[options]\n");
	printf("\t" OPT_FLAG "D\tDecompress\n");
	exit(1);
}
