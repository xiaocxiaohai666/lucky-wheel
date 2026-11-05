import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;
import java.util.zip.*;

/**
 * 把 assets 目录和 classes.dex 打进 APK。
 *
 * <p><b>为什么不用 aapt2 的 -A：</b>Windows 版的 aapt2 会把目录里的路径
 * 原样（用反斜杠）写进 zip 条目名，例如 `assets/www\index.html`。
 * APK 能装、能启动，但 AssetManager 只认正斜杠，一个文件都读不到，
 * 网页直接 404。所以这里自己遍历目录，路径一律用 "/" 拼。
 *
 * <p>同时保留每个原条目的压缩方式：resources.arsc 必须是 STORED，
 * targetSdk 30+ 的包如果把它压缩了，安装会失败。
 *
 * 用法：java PackAssets.java <apk> <assetsDir> <classes.dex>
 */
public class PackAssets {

    public static void main(String[] args) throws Exception {
        Path apk = Paths.get(args[0]);
        Path assetsDir = Paths.get(args[1]);
        Path dex = args.length > 2 ? Paths.get(args[2]) : null;
        Path tmp = Paths.get(args[0] + ".tmp");

        List<Path> assetFiles = new ArrayList<>();
        if (Files.isDirectory(assetsDir)) {
            try (Stream<Path> walk = Files.walk(assetsDir)) {
                assetFiles = walk.filter(Files::isRegularFile).sorted()
                        .collect(Collectors.toList());
            }
        }

        try (ZipFile src = new ZipFile(apk.toFile());
             ZipOutputStream out = new ZipOutputStream(Files.newOutputStream(tmp))) {

            Enumeration<? extends ZipEntry> entries = src.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();

                // 原有条目：名字一个字符都不动
                ZipEntry copy = new ZipEntry(entry.getName());
                if (entry.getTime() > 0) {
                    copy.setTime(entry.getTime());
                }

                if (entry.getMethod() == ZipEntry.STORED) {
                    byte[] data = src.getInputStream(entry).readAllBytes();
                    CRC32 crc = new CRC32();
                    crc.update(data);
                    copy.setMethod(ZipEntry.STORED);
                    copy.setSize(data.length);
                    copy.setCompressedSize(data.length);
                    copy.setCrc(crc.getValue());

                    out.putNextEntry(copy);
                    out.write(data);
                } else {
                    out.putNextEntry(copy);
                    try (InputStream in = src.getInputStream(entry)) {
                        in.transferTo(out);
                    }
                }
                out.closeEntry();
            }

            // assets：路径一律用正斜杠
            for (Path file : assetFiles) {
                String rel = assetsDir.relativize(file).toString().replace(File.separatorChar, '/');
                out.putNextEntry(new ZipEntry("assets/" + rel));
                Files.copy(file, out);
                out.closeEntry();
            }

            if (dex != null && Files.isRegularFile(dex)) {
                out.putNextEntry(new ZipEntry("classes.dex"));
                Files.copy(dex, out);
                out.closeEntry();
            }
        }

        Files.move(tmp, apk, StandardCopyOption.REPLACE_EXISTING);
        System.out.println("  assets " + assetFiles.size() + " 个 + classes.dex");
    }
}
