// Search for Texture and Material types and chunk UIDs in Ghidra
import ghidra.app.script.GhidraScript;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;

public class FindTextureTypes extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Searching for Texture and Material symbols ===");
        String[] keywords = {"qTexture", "TextureResource", "TextureHeader", "Render::Texture", "Illusion::Texture", "Illusion::Material"};
        SymbolIterator it = currentProgram.getSymbolTable().getAllSymbols(true);
        int count = 0;
        while (it.hasNext()) {
            Symbol s = it.next();
            String name = s.getName();
            for (String kw : keywords) {
                if (name.contains(kw)) {
                    println(String.format("Found: %s @ %s", name, s.getAddress()));
                    count++;
                    break;
                }
            }
        }
        println("Total matched: " + count);
    }
}

