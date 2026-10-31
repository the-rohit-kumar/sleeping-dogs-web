import struct

SFX_PCK = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2\SFX.pck"

with open(SFX_PCK, "rb") as f:
    # Let's inspect Track ID 129282 @ 0x9251ad9 (21906 bytes)
    f.seek(0x9251ad9)
    wem_data = f.read(21906)

riff, riff_sz, wave = struct.unpack("<4sI4s", wem_data[:12])
print(f"Container: {riff.decode()} size={riff_sz}")

pos = 12
fmt_data = None
data_payload = None

while pos < len(wem_data) - 8:
    tag = wem_data[pos:pos+4].decode('latin1', errors='ignore')
    sz = struct.unpack("<I", wem_data[pos+4:pos+8])[0]
    print(f"Chunk [{tag}] size={sz} at offset 0x{pos:x}")
    if tag == "fmt ":
        fmt_data = wem_data[pos+8:pos+8+sz]
    elif tag == "data":
        data_payload = wem_data[pos+8:pos+8+sz]
    pos += 8 + sz

if fmt_data and data_payload:
    print(f"\nfmt_data length: {len(fmt_data)}")
    print(f"data_payload length: {len(data_payload)}")
    
    # Inspect first few packet lengths in data_payload
    # Wwise Vorbis stores packets with a 2-byte size header:
    p_pos = 0
    packets = []
    while p_pos < min(len(data_payload), 500):
        if p_pos + 2 > len(data_payload):
            break
        pkt_sz = struct.unpack("<H", data_payload[p_pos:p_pos+2])[0]
        if pkt_sz == 0 or pkt_sz > 4096:
            break
        packets.append((p_pos, pkt_sz))
        p_pos += 2 + pkt_sz
        
    print(f"Found {len(packets)} sequential packets with 2-byte size headers:")
    for i, (off, sz) in enumerate(packets[:10]):
        first_byte = data_payload[off+2]
        print(f"  Packet {i}: offset={off} sz={sz} (first byte=0x{first_byte:02x}, packet_type={first_byte & 1})")

