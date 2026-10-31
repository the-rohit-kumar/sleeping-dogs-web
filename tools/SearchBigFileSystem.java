// Search for BigFileSystem and chunk decompression routines in Ghidra
import ghidra.app.script.GhidraScript;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;

public class SearchBigFileSystem extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Searching for BigFile / Chunk / Decompress symbols ===");
        String[] keywords = {"BigFile", "BigFileSystem", "Chunk", "Decompress", "LZO", "zlib", "deflate", "LZMA"};
        SymbolIterator it = currentProgram.getSymbolTable().getAllSymbols(true);
        int found = 0;
        while (it.hasNext()) {
            Symbol sym = it.next();
            String name = sym.getName();
            for (String kw : keywords) {
                if (name.toLowerCase().contains(kw.toLowerCase())) {
                    println(String.format("Found: %s @ %s", name, sym.getAddress()));
                    found++;
                    break;
                }
            }
        }
        println("Total matched symbols: " + found);
    }
}

