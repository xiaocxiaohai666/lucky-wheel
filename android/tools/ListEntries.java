import java.io.*;
import java.util.zip.*;

/** 诊断用：打印 APK 里 assets 条目名的真实字符，反斜杠会被标成 <BS> */
public class ListEntries {
    public static void main(String[] args) throws Exception {
        try (ZipFile zip = new ZipFile(args[0])) {
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry e = entries.nextElement();
                String name = e.getName();
                if (name.contains("www") || name.contains("index")) {
                    System.out.println(name.replace("\\", "<BS>")
                            + "   method=" + e.getMethod()
                            + "   size=" + e.getSize());
                }
            }
        }
    }
}
