/* Build-only streaming TAR/GZIP index. Runtime playback uses standard Node zlib.
 * The byte-aligned Z_BLOCK checkpoint method is described in zlib's zran example:
 * https://github.com/madler/zlib/blob/master/examples/zran.c
 * This is a separate implementation; no zlib source or native executable is deployed.
 */
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <zlib.h>
#ifdef _WIN32
#include <direct.h>
#include <fcntl.h>
#include <io.h>
#define MKDIR(path) _mkdir(path)
#else
#define MKDIR(path) mkdir(path, 0755)
#endif

#define SPAN (8ULL * 1024 * 1024)
#define MAX_METADATA (4ULL * 1024 * 1024 * 1024)
static FILE *shards[256], *metadata, *inventory;
static char root[2048], long_name[8192];
static unsigned char header[512];
static size_t header_used;
static uint64_t position, remaining, padding, count, metadata_bytes, header_size;
static char entry_name[8192], entry_type;
static size_t name_used;

static void fail(const char *message) { fprintf(stderr, "%s\n", message); exit(1); }
static void little(unsigned char *bytes, uint64_t value, unsigned length) {
    for (unsigned i = 0; i < length; i++) { bytes[i] = value & 255; value >>= 8; }
}
static int hex_digit(char value) {
    if (value >= '0' && value <= '9') return value - '0';
    if (value >= 'a' && value <= 'f') return value - 'a' + 10;
    return -1;
}
static void start_entry(void) {
    char name[101] = {0}, prefix[156] = {0}, size[13] = {0};
    memcpy(name, header, 100); memcpy(prefix, header + 345, 155); memcpy(size, header + 124, 12);
    if (!name[0]) { remaining = 0; return; }
    char *end;
    header_size = strtoull(size, &end, 8);
    if (end == size || header_size > (1ULL << 40)) fail("Invalid TAR entry length");
    if (long_name[0]) { snprintf(entry_name, sizeof(entry_name), "%s", long_name); long_name[0] = 0; }
    else if (prefix[0] && !memcmp(header + 257, "ustar", 5)) snprintf(entry_name, sizeof(entry_name), "%s/%s", prefix, name);
    else snprintf(entry_name, sizeof(entry_name), "%s", name);
    entry_type = header[156]; remaining = header_size; padding = (512 - header_size % 512) % 512; name_used = 0;
    const char *base = strrchr(entry_name, '/'); base = base ? base + 1 : entry_name;
    if ((!entry_type || entry_type == '0') && strstr(entry_name, "MIDIs/")
        && strlen(base) == 36 && !strcmp(base + 32, ".mid")) {
        unsigned char record[28];
        for (unsigned i = 0; i < 16; i++) {
            int a = hex_digit(base[i * 2]), b = hex_digit(base[i * 2 + 1]);
            if (a < 0 || b < 0) fail("Unexpected MIDI hash");
            record[i] = a * 16 + b;
        }
        if (header_size > UINT32_MAX) fail("MIDI too large for index");
        little(record + 16, position, 8); little(record + 24, header_size, 4);
        if (fwrite(record, 1, sizeof(record), shards[record[0]]) != sizeof(record)) fail("Cannot write MIDI index");
        count++;
    }
    if ((!entry_type || entry_type == '0') &&
        (strstr(entry_name, "DATA/Identified MIDIs/") || strstr(entry_name, "DATA/Files Lists/")
        || strstr(entry_name, "DATA/Genres MIDIs/") || strstr(entry_name, "DATA/Mono Melodies/"))) {
        if (metadata_bytes + header_size > MAX_METADATA) fail("Metadata exceeds local extraction budget");
        metadata_bytes += header_size;
        char safe[4096], path[6144]; size_t length = strlen(entry_name);
        if (length >= sizeof(safe)) fail("Metadata filename too long");
        for (size_t i = 0; i <= length; i++) {
            char c = entry_name[i];
            safe[i] = (!c || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                || (c >= '0' && c <= '9') || c == '.' || c == '-') ? c : '_';
        }
        snprintf(path, sizeof(path), "%s/metadata/%s", root, safe);
        metadata = fopen(path, "wb"); if (!metadata) fail("Cannot save metadata");
        fprintf(inventory, "%s\t%llu\t%s\n", safe, (unsigned long long)header_size, entry_name);
        fflush(inventory);
        if (!remaining) { fclose(metadata); metadata = NULL; }
    }
}
static void tar_bytes(const unsigned char *bytes, size_t length) {
    while (length) {
        if (remaining) {
            size_t take = remaining < length ? (size_t)remaining : length;
            if (metadata && fwrite(bytes, 1, take, metadata) != take) fail("Metadata write failed");
            if (entry_type == 'L') {
                if (name_used + take >= sizeof(long_name)) fail("TAR long filename exceeds bound");
                memcpy(long_name + name_used, bytes, take); name_used += take; long_name[name_used] = 0;
            }
            bytes += take; length -= take; position += take; remaining -= take;
            if (!remaining && metadata) { fclose(metadata); metadata = NULL; }
        } else if (padding) {
            size_t take = padding < length ? (size_t)padding : length;
            bytes += take; length -= take; position += take; padding -= take;
        } else {
            size_t take = 512 - header_used; if (take > length) take = length;
            memcpy(header + header_used, bytes, take);
            bytes += take; length -= take; position += take; header_used += take;
            if (header_used == 512) { header_used = 0; start_entry(); }
        }
    }
}
int main(int argc, char **argv) {
    if (argc != 2 || strlen(argv[1]) >= sizeof(root)) fail("Usage: index-squd-discover OUTPUT_DIRECTORY");
    strcpy(root, argv[1]); MKDIR(root);
    char path[4096]; snprintf(path, sizeof(path), "%s/metadata", root); MKDIR(path);
    snprintf(path, sizeof(path), "%s/points.jsonl", root); FILE *points = fopen(path, "wb");
    snprintf(path, sizeof(path), "%s/windows.bin", root); FILE *windows = fopen(path, "wb");
    snprintf(path, sizeof(path), "%s/metadata.tsv", root); inventory = fopen(path, "wb");
    if (!points || !windows || !inventory) fail("Cannot open output files");
    for (unsigned i = 0; i < 256; i++) {
        snprintf(path, sizeof(path), "%s/midis-%02x.bin", root, i); shards[i] = fopen(path, "wb");
        if (!shards[i]) fail("Cannot open index shard");
    }
#ifdef _WIN32
    _setmode(_fileno(stdin), _O_BINARY);
#endif
    unsigned char input[65536], output[65536], dictionary[32768];
    z_stream stream = {0}; if (inflateInit2(&stream, 47) != Z_OK) fail("Cannot initialize zlib");
    uint64_t consumed = 0, produced = 0, last = 0, dictionary_offset = 0;
    unsigned checkpoint_count = 0; int result = Z_OK; time_t last_report = time(NULL);
    while (result != Z_STREAM_END) {
        if (!stream.avail_in) {
            stream.avail_in = (unsigned)fread(input, 1, sizeof(input), stdin); stream.next_in = input;
            if (!stream.avail_in) fail("Truncated archive");
        }
        stream.next_out = output; stream.avail_out = sizeof(output); unsigned before = stream.avail_in;
        result = inflate(&stream, Z_BLOCK); consumed += before - stream.avail_in;
        size_t length = sizeof(output) - stream.avail_out; produced += length; tar_bytes(output, length);
        if (result < 0) fail("Invalid compressed archive");
        if ((stream.data_type & 128) && !(stream.data_type & 64) && !(stream.data_type & 7)
            && (!checkpoint_count || produced - last >= SPAN)) {
            unsigned dictionary_length = 0;
            if (inflateGetDictionary(&stream, dictionary, &dictionary_length) != Z_OK) fail("Cannot read zlib dictionary");
            fprintf(points, "{\"in\":%llu,\"out\":%llu,\"dictionary\":%llu,\"length\":%u}\n",
                (unsigned long long)consumed, (unsigned long long)produced,
                (unsigned long long)dictionary_offset, dictionary_length);
            if (fwrite(dictionary, 1, dictionary_length, windows) != dictionary_length) fail("Cannot write dictionary");
            dictionary_offset += dictionary_length; last = produced; checkpoint_count++;
        }
        time_t now = time(NULL);
        if (now - last_report >= 20) {
            fprintf(stderr, "indexed %.1f MB compressed; %llu MIDIs; %u checkpoints\n",
                consumed / 1048576.0, (unsigned long long)count, checkpoint_count); last_report = now;
            fflush(points); fflush(windows);
        }
    }
    if (remaining || padding || header_used) fail("Incomplete TAR stream");
    for (unsigned i = 0; i < 256; i++) fclose(shards[i]);
    fclose(points); fclose(windows); fclose(inventory); inflateEnd(&stream);
    snprintf(path, sizeof(path), "%s/index-summary.json", root); FILE *summary = fopen(path, "wb");
    if (!summary) fail("Cannot write index summary");
    fprintf(summary, "{\"midis\":%llu,\"compressedBytes\":%llu,\"uncompressedBytes\":%llu,\"checkpoints\":%u,\"metadataBytes\":%llu}\n",
        (unsigned long long)count, (unsigned long long)consumed, (unsigned long long)produced,
        checkpoint_count, (unsigned long long)metadata_bytes);
    fclose(summary); return 0;
}
