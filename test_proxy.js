async function check() {
  try {
    const res = await fetch("https://ink.skadas.com/api/v1/upload-proxy?path=uploads/org-logos/cmq9oanyn0000sxz44nelr2pl_1781711511615.webp");
    console.log("Status:", res.status);
    console.log("StatusText:", res.statusText);
    const text = await res.text();
    console.log("Body:", text.slice(0, 200));
  } catch(e) {
    console.error(e);
  }
}
check();
