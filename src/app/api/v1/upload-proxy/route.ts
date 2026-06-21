import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return new NextResponse("Missing path parameter", { status: 400 });
  }

  try {
    // If we have an upload proxy configured, proxy the image from the cPanel server
    if (process.env.UPLOAD_PROXY_URL) {
      // Determine the base URL for fetching the image
      let targetUrl = "";
      if (process.env.NEXT_PUBLIC_UPLOAD_BASE_URL && process.env.NEXT_PUBLIC_UPLOAD_BASE_URL.trim() !== "") {
        const base = process.env.NEXT_PUBLIC_UPLOAD_BASE_URL.trim().replace(/\/$/, "");
        targetUrl = `${base}/${filePath}`;
      } else {
        const proxyUrl = new URL(process.env.UPLOAD_PROXY_URL);
        const lastSlashIndex = proxyUrl.pathname.lastIndexOf("/");
        const basePath = lastSlashIndex !== -1 ? proxyUrl.pathname.substring(0, lastSlashIndex) : "";
        targetUrl = `${proxyUrl.origin}${basePath}/${filePath}`;
      }
      
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Vercel/UploadProxy",
          "Accept": "image/*,*/*"
        }
      });
      
      if (!response.ok) {
        return new NextResponse(`File not found on remote server (${targetUrl})`, { status: 404 });
      }

      const contentType = response.headers.get("content-type") || "image/webp";
      const arrayBuffer = await response.arrayBuffer();

      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Local fallback: read from public directory
    const absolutePath = path.join(process.cwd(), "public", filePath);
    
    // Security check to prevent directory traversal
    if (!absolutePath.startsWith(path.join(process.cwd(), "public"))) {
      return new NextResponse("Invalid path", { status: 400 });
    }

    const fileBuffer = await readFile(absolutePath);
    
    // Guess basic content types based on extension
    let contentType = "application/octet-stream";
    if (filePath.endsWith(".webp")) contentType = "image/webp";
    else if (filePath.endsWith(".png")) contentType = "image/png";
    else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (filePath.endsWith(".pdf")) contentType = "application/pdf";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Upload proxy error:", error);
    return new NextResponse("File not found", { status: 404 });
  }
}
