// A simple Ghidra Java script
import ghidra.app.script.GhidraScript;

public class TestScript extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("SUCCESS_FROM_GHIDRA_JAVA: Program name = " + currentProgram.getName());
        println("Image base = " + currentProgram.getImageBase());
    }
}

