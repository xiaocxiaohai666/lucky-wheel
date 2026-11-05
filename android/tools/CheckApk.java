import java.util.zip.*;
public class CheckApk {
    public static void main(String[] a) throws Exception {
        boolean ok = true;
        try (ZipFile z = new ZipFile(a[0])) {
            var en = z.entries();
            while (en.hasMoreElements()) {
                ZipEntry e = en.nextElement();
                String n = e.getName();
                if (n.indexOf('\\') >= 0) {
                    System.out.println("BAD 条目名含反斜杠: " + n);
                    ok = false;
                }
                if (n.equals("resources.arsc")) {
                    boolean stored = e.getMethod() == ZipEntry.STORED;
                    System.out.println("resources.arsc method=" + (stored ? "STORED ✓" : "DEFLATED ✗"));
                    ok &= stored;
                }
                if (n.equals("classes.dex")) {
                    System.out.println("classes.dex 存在 ✓ size=" + e.getSize());
                }
                if (n.equals("assets/www/index.html")) {
                    System.out.println("assets/www/index.html 存在 ✓ size=" + e.getSize());
                }
            }
        }
        System.out.println(ok ? "APK 结构检查通过" : "APK 结构有问题");
        System.exit(ok ? 0 : 1);
    }
}
