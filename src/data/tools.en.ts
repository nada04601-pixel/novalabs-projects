import type { EnTool } from "@/lib/i18n";

// 영어 버전 도구(/en/tools/[slug])의 제목·설명·사용법·FAQ. 화면 문구는 각 컴포넌트에서 useT로 바꿉니다.
export const EN_CATEGORIES = ["PDF", "Images", "Video & audio", "Utilities", "Personality & fortune"] as const;
export type EnCategory = (typeof EN_CATEGORIES)[number];

export type EnToolInfo = {
  slug: EnTool;
  category: EnCategory;
  title: string;
  short: string;
  metaDescription: string;
  intro: string;
  howTo: { heading: string; body: string }[];
  faq: { q: string; a: string }[];
  // 페이지 맨 아래 안내 문구. 비우면 "파일을 서버로 보내지 않음" 문구를 씁니다.
  note?: string;
};

const PRIVATE = "Files never leave your device: everything runs inside your browser, and nothing is uploaded to a server.";

export const toolsEn: EnToolInfo[] = [
  {
    slug: "pdf-compress",
    category: "PDF",
    title: "Compress PDF",
    short: "Shrink PDF files right in your browser, without uploading them.",
    metaDescription:
      "Free online PDF compressor that works entirely in your browser. Reduce the size of scanned PDFs by choosing an image quality, or do a light clean-up that keeps text selectable. No upload, no sign-up.",
    intro:
      `Make a PDF small enough for an email attachment or an upload limit. ${PRIVATE} That makes it safe for contracts, IDs and other sensitive documents.`,
    howTo: [
      {
        heading: "Two ways to compress",
        body: "'Strong' redraws every page as a JPEG image at a set resolution (96, 130 or 170 dpi) and builds a new PDF. Scans and photo-heavy documents often shrink to half their size or less, but text becomes part of the image, so it can no longer be selected, searched or copied, and links are removed. 'Light' keeps text and links and only rewrites the PDF's internal structure. Files that are already optimized may barely shrink.",
      },
      {
        heading: "Choosing the quality",
        body: "For documents that will only be read on screen, 'Smallest' (96 dpi) is usually readable. Use 'Recommended' (130 dpi) for everyday paperwork and 'High quality' (170 dpi) for small print or documents you will print. If the result looks blurry, compress the original again one step higher.",
      },
      {
        heading: "Privacy and limits",
        body: "Processing happens in your browser and the result downloads straight to your device. Files up to 200 MB are supported. Long documents can be slow or run out of memory on phones, so a computer is recommended. Remove any password from the PDF before compressing it.",
      },
    ],
    faq: [
      { q: "The compressed file got bigger.", a: "Text-based PDFs are already small, and turning their pages into images can make them larger. Use 'Light' instead, or keep the original." },
      { q: "Does it work with signed PDFs or fillable forms?", a: "Compressing invalidates digital signatures, and 'Strong' turns form fields into flat images. Submit the original if the document is signed." },
      { q: "Is my file stored anywhere?", a: "No. The file is never uploaded, and it disappears from browser memory when you close the page." },
    ],
  },
  {
    slug: "pdf-merge",
    category: "PDF",
    title: "Merge PDF",
    short: "Combine several PDF files into one, in the order you choose.",
    metaDescription:
      "Free online tool to merge PDF files in your browser. Reorder files, check page counts and download a single combined PDF. No upload, no sign-up, no watermark.",
    intro:
      `Use it to put application documents into a single file or to join pages that were scanned separately. Pick several files, set the order, and get one PDF. ${PRIVATE}`,
    howTo: [
      {
        heading: "Setting the order",
        body: "Files are listed in the order you add them, and the top of the list becomes the front of the merged PDF. Use the up and down arrows to reorder and ✕ to remove a file. If your file names are numbered (01, 02…), 'Sort by name' puts them in order in one click. Numbers are compared by value, so 2 comes before 10.",
      },
      {
        heading: "What is preserved",
        body: "Text, images, links, page sizes and orientation are copied exactly as they are. Nothing is redrawn or recompressed, so quality is unchanged and the merged file is roughly the sum of the originals. Bookmarks, fillable forms and digital signatures may not work in the merged file.",
      },
      {
        heading: "Limits",
        body: "You can add up to 50 files at once, each up to 200 MB. All files are loaded into your device's memory, so large batches may be slow or fail on phones; a computer is recommended. Password-protected or damaged files are flagged in the list and skipped.",
      },
    ],
    faq: [
      { q: "The merged file is too large.", a: "Merging joins the originals as they are, so the size doesn't go down. If you have an attachment limit, run the merged file through Compress PDF." },
      { q: "Can I merge JPG images too?", a: "This tool merges PDF files only. Turn images into a PDF first with Images to PDF, then merge." },
      { q: "How do I remove some pages after merging?", a: "Open the merged file in Organize PDF pages and delete the pages you don't need. You can also reorder and rotate pages there." },
      { q: "Is my file stored anywhere?", a: "No. Files are never uploaded, and they disappear from browser memory when you close the page." },
    ],
  },
  {
    slug: "pdf-split",
    category: "PDF",
    title: "Split PDF & Extract Pages",
    short: "Split a PDF by page ranges, or pull out just the pages you need.",
    metaDescription:
      "Free online PDF splitter that runs in your browser. Split by page ranges, split every N pages, or extract selected pages into one new PDF. No upload, no sign-up.",
    intro:
      `Send only the pages someone needs from a long PDF, or break a file into parts to get under a size limit. Enter page numbers and get new PDFs. ${PRIVATE}`,
    howTo: [
      {
        heading: "Three ways to split",
        body: "'Split by ranges' makes one file per comma-separated range: '1-3, 4-10' gives a 3-page file and a 7-page file. 'Every N pages' cuts the document into equal chunks from the start; enter 1 to save every page as its own file. 'Extract pages' collects all the pages you list into a single file.",
      },
      {
        heading: "Writing page numbers",
        body: "Use '5' for a single page and '1-3' for a range. '8-' means page 8 to the end and '-3' means the start through page 3. A reversed range such as '5-3' extracts pages 5, 4, 3 in that order. While you type, a preview below shows how many files will be created and which pages each contains.",
      },
      {
        heading: "Quality and size",
        body: "Pages are copied, not redrawn, so text selection, search, links and quality are all preserved. Split files are usually smaller in proportion to their page count, but fonts or images shared by many pages are included in each file, so the total can exceed the original.",
      },
    ],
    faq: [
      { q: "Can I download all the split files at once?", a: "Yes. When there are two or more files, use 'Bundle as ZIP' to download them as a single ZIP file, or download files individually. Up to 100 files can be created at once." },
      { q: "Can the same page go into several files?", a: "Yes. Overlapping ranges such as '1-3, 3-5' put page 3 in both files. In 'Extract pages', '1, 1' creates a file that contains the same page twice." },
      { q: "Can I split a password-protected PDF?", a: "PDFs with an open password or editing restrictions can't be processed. If you know the password, remove it in a PDF viewer, save, and try again." },
    ],
  },
  {
    slug: "pdf-organize",
    category: "PDF",
    title: "Organize PDF Pages",
    short: "Reorder, rotate and delete PDF pages with thumbnails.",
    metaDescription:
      "Free online tool to reorder, rotate and delete PDF pages while viewing thumbnails. Works entirely in your browser with no upload.",
    intro:
      `Straighten pages that were scanned upside down, fix pages that are out of order, or remove blank pages. Every page appears as a thumbnail so you can check as you go. ${PRIVATE}`,
    howTo: [
      {
        heading: "How to organize",
        body: "Choose a file and every page appears as a thumbnail. Use ← → to move a page one step, ↺ ↻ to rotate it 90 degrees left or right, and ✕ to delete it. If every page needs rotating, such as a document scanned sideways, use 'Rotate all left' or 'Rotate all right'. Made a mistake? 'Reset' brings back the original order.",
      },
      {
        heading: "How rotation is saved",
        body: "Page content is not redrawn; only the PDF's rotation setting for that page is changed. Quality stays the same and text can still be selected and searched. The 'Original page N' label under each thumbnail shows where the page came from.",
      },
      {
        heading: "Limits",
        body: "Because a thumbnail is drawn for every page, documents of up to 500 pages are supported. Split longer documents first with Split PDF. Thumbnails for long documents take a while to appear, but you can reorder and rotate pages while they load.",
      },
    ],
    faq: [
      { q: "Does it work on phones?", a: "Yes. Thumbnails are shown in two columns and you organize pages with the buttons. Long files are faster to handle on a computer." },
      { q: "Does it find blank pages automatically?", a: "It doesn't delete pages automatically, so nearly empty pages aren't removed by mistake. Spot blank pages in the thumbnails and delete them with ✕." },
      { q: "Can I insert pages from another PDF?", a: "Merge the two files with Merge PDF first, then move the inserted pages to the right place here." },
    ],
  },
  {
    slug: "jpg-to-pdf",
    category: "PDF",
    title: "Images to PDF",
    short: "Turn photos and images (JPG, PNG) into a single PDF.",
    metaDescription:
      "Free online JPG to PDF converter that runs in your browser. Combine several images into one PDF in order, fit them to A4 with margins, or keep each image's own size. No upload.",
    intro:
      `Use it when you need to submit phone photos of documents or screenshots as a PDF. Choose several images and get one PDF with one image per page. ${PRIVATE}`,
    howTo: [
      {
        heading: "Page size and margins",
        body: "'Fit to A4' picks portrait or landscape A4 for each image and centers it inside the margins while keeping its proportions, which suits printing and paperwork. Small, low-resolution images are not stretched, so they don't get blurry. 'Same as image' makes each page match the image's proportions with no margins, which suits on-screen viewing.",
      },
      {
        heading: "Order and quality",
        body: "Pages follow the order you add images. Use ← → to reorder and ✕ to remove one. If file names are numbered, 'Sort by name' puts them in order. JPG and PNG files are embedded as they are, without recompression, so quality is unchanged and the PDF is about the size of the images combined.",
      },
      {
        heading: "Phone photos lying sideways",
        body: "Phones often store photos sideways and add a note saying how to rotate them for display. PDFs ignore that note, so such photos would appear sideways. This tool straightens those photos before adding them, so the PDF matches the preview. Only in that case is the image re-saved as a 92% quality JPG.",
      },
    ],
    faq: [
      { q: "Do iPhone photos (HEIC) work?", a: "When you pick photos from the photo library in Safari on iPhone, they usually arrive as JPG. HEIC files copied to a computer may not open in every browser. Setting iPhone Camera > Formats to 'Most Compatible' saves new photos as JPG." },
      { q: "The PDF is too large.", a: "Original phone photos are often 3-5 MB each. Run the PDF through Compress PDF to make it much smaller while keeping it readable." },
      { q: "Do WebP or GIF images work?", a: "Any format your browser can open works. Images other than JPG and PNG are drawn by the browser and converted to JPG; for animated GIFs only the first frame is used." },
      { q: "Are my images stored anywhere?", a: "No. Images are never uploaded, and they disappear from browser memory when you close the page." },
    ],
  },
  {
    slug: "pdf-to-jpg",
    category: "PDF",
    title: "PDF to Images",
    short: "Convert each PDF page into a JPG or PNG image.",
    metaDescription:
      "Free online PDF to JPG converter that runs in your browser. Choose quality and page ranges, then download images one by one or all pages in a ZIP. No upload.",
    intro:
      `Post a page of a PDF as an image on a messaging app or social media, or drop it into a presentation. Each page becomes one image. ${PRIVATE}`,
    howTo: [
      {
        heading: "Format and quality",
        body: "JPG files are small and good for sharing and posting online; PNG keeps text and lines crisp but is larger. Choose 'Standard' (100 dpi) for on-screen viewing, 'Sharp' (150 dpi) for documents you'll zoom into or small print, and 'Print' (300 dpi) for printing. An A4 page at 300 dpi is about 2480×3508 pixels.",
      },
      {
        heading: "Converting only some pages",
        body: "Leave the pages field empty to convert every page, or enter page numbers such as '1-3, 5'. '8-' means page 8 to the end. Up to 200 pages can be converted at once; for longer documents, convert in several ranges.",
      },
      {
        heading: "Downloading",
        body: "Each converted page gets a preview and a download button. To get them all at once, use 'Bundle as ZIP' and download the ZIP file. File names such as 'document-01.jpg' are zero-padded, so sorting by name keeps the page order.",
      },
    ],
    faq: [
      { q: "The images look blurry.", a: "Raise the quality to 'Sharp' or 'Print' and choose PNG. If the original PDF is a low-quality scan, a higher setting can't make it sharper than the source." },
      { q: "I can't open the ZIP on my phone.", a: "On iPhone, tap the ZIP in the Files app to extract it. On Android, use the built-in file manager or an archive app. If you only need a few pages, the per-page download buttons are simpler." },
      { q: "Can I copy the text?", a: "Once converted, text is part of the image and can't be selected or searched. Keep the original PDF if you need the text." },
    ],
  },
  {
    slug: "image-upscaler",
    category: "Images",
    title: "AI Image Upscaler",
    short: "Enlarge small or blurry images 2x or 4x with AI and make them sharper.",
    metaDescription:
      "Free AI image upscaler that runs in your browser. Enlarge photos 2x or 4x with an ESRGAN model to recover detail, or use the instant Fast mode (Lanczos). Images are never uploaded.",
    intro:
      `Enlarge small web images, old photos, or logos that break up when zoomed, by 2x or 4x. AI mode restores blurry edges and textures, while Fast mode gives an instant result on any device. Compare the original and the result side by side, then download. ${PRIVATE}`,
    howTo: [
      {
        heading: "AI mode",
        body: "An ESRGAN super-resolution model (UpscalerJS ESRGAN Medium, MIT license) runs in your browser with TensorFlow.js. The image is processed in small tiles and stitched back together, so it works even on devices with little graphics memory. The model file (about 3 MB) is downloaded from this site the first time and is usually reused from your browser cache afterwards. Without graphics acceleration (WebGL), AI mode can be very slow.",
      },
      {
        heading: "Fast mode",
        body: "Lanczos3 interpolation fills in pixels smoothly, then an unsharp mask sharpens edges. It runs in a background thread, so the page stays responsive even with large images. It doesn't invent missing detail: text and simple graphics look fine in Fast mode, while photos benefit more from AI mode.",
      },
      {
        heading: "Size limits",
        body: "Results can be up to 8,192 px on a side and 16 megapixels. To keep processing time reasonable, AI mode accepts originals up to 1.5 megapixels at 2x and 0.5 megapixels at 4x. For larger images, use Fast mode or a lower scale.",
      },
    ],
    faq: [
      { q: "Are my images uploaded?", a: "No. Everything happens in your browser. The only thing downloaded from this site is the AI model file; your images are never sent anywhere." },
      { q: "Does it keep PNG transparency?", a: "Fast mode keeps transparency. AI mode fills transparent areas with white before processing, so use Fast mode if you need a transparent background." },
      { q: "AI mode is very slow.", a: "On devices without graphics acceleration or with little memory it can take from tens of seconds to several minutes. 2x or Fast mode is much quicker, and you can cancel any time with 'Stop'." },
      { q: "Can faces or text change?", a: "AI fills in blurry areas with plausible detail, so very small text or faces can differ subtly from the original. For documents or ID photos where accuracy matters, compare with the Fast mode result." },
    ],
  },
  {
    slug: "remove-background",
    category: "Images",
    title: "Remove Background (AI)",
    short: "Remove the background from photos of people or products with AI and save a transparent PNG or a white-background JPG.",
    metaDescription:
      "Free AI background remover that runs in your browser. Keep only people, products or pets and save a transparent PNG, a white-background JPG or any solid color, with optional crop to the subject. No sign-up, no upload.",
    intro:
      `Remove the background from profile photos, product shots for online stores, or portraits for slides. Choose an image and press 'Remove background': the AI finds the subject and makes the background transparent. Then switch to white or any color, or crop to the subject, while you watch the result. ${PRIVATE}`,
    howTo: [
      {
        heading: "Choosing a model",
        body: "'People (fast)' uses MODNet (Apache-2.0), tuned for photos of people: a small download that runs quickly even on phones. 'Objects & products (precise)' uses BiRefNet lite (MIT) for products, pets, objects and fine hair edges, but the model is large (about 115 MB, or about 220 MB without a GPU) and slower, so a computer is recommended. If a person is cut out awkwardly, try the precise model.",
      },
      {
        heading: "Background and format",
        body: "'Transparent' saves a PNG with no background, ready to place over other images or designs. 'White' saves a JPG suited to marketplace product photo rules, and 'Pick a color' saves a JPG with any solid background. Changing the background doesn't re-run the AI, so it updates instantly.",
      },
      {
        heading: "How it works",
        body: "The model looks at a 512–1024 px version of the image to find the subject (a mask), then the mask is scaled up so the cut-out keeps the original resolution. It runs on the GPU when WebGPU is available, otherwise on the CPU. The model is downloaded once from Hugging Face and kept in your browser for next time.",
      },
    ],
    faq: [
      { q: "Are my images uploaded?", a: "No. Background removal happens in your browser. Only the AI model file is downloaded the first time; your images are never sent anywhere." },
      { q: "Hair and edges look rough.", a: "Try 'Objects & products (precise)'. When the subject and background have similar colors or the background is busy, edges can blur; photos taken against a plain background give the cleanest results." },
      { q: "It freezes or fails on my phone.", a: "The precise model uses a lot of memory and can fail on phones. Choose 'People (fast)' or use Chrome or Edge on a computer. The first run downloads the model, so Wi-Fi is recommended." },
      { q: "Can I use the results commercially?", a: "The AI models are licensed for commercial use (MODNet Apache-2.0, BiRefNet MIT). Copyright and portrait rights of the result still follow the original photo, so use photos you took or have rights to." },
    ],
  },
  {
    slug: "image-compress",
    category: "Images",
    title: "Compress & Convert Images (JPG, PNG, WebP)",
    short: "Shrink image file sizes and convert between JPG, PNG and WebP, even to a target size like 200 KB.",
    metaDescription:
      "Free online image compressor and converter that runs in your browser. Reduce photo file size, convert to JPG, PNG or WebP, fit a target size such as 200 KB, resize, and batch convert with ZIP download. No upload.",
    intro:
      `Use it when a form or marketplace says your file is too large, when blog photos are too heavy, or when you need to turn a PNG into a JPG or a WebP into something that opens everywhere. Add several images, choose a format, quality and size, and see each result's size and how much it shrank. ${PRIVATE}`,
    howTo: [
      {
        heading: "Choosing a format",
        body: "JPG suits photos and opens everywhere. WebP is usually 25–35% smaller than JPG at the same quality and keeps transparency, which makes it ideal for websites. PNG is lossless and best for text and screenshots, but photos get large. When converting to JPG, transparent areas are filled with white.",
      },
      {
        heading: "Fitting a target size",
        body: "Choose 'Under a target size' and enter something like 200KB or 1MB. The tool tries several quality levels and keeps the best one that fits. If a large photo is still too big at the lowest quality, reduce its dimensions with Resize as well.",
      },
      {
        heading: "Resizing",
        body: "Scale to a percentage of the original, or set the length of the longer side in pixels. Proportions are kept and images are never enlarged. Shrinking a phone photo (around 4000 px) to 1920 px on the long side looks almost the same on screen and is usually less than a quarter of the size.",
      },
    ],
    faq: [
      { q: "Are my images uploaded?", a: "No. All conversion happens in your browser and your images are never sent anywhere." },
      { q: "The converted file is larger than the original.", a: "Re-saving an already compressed JPG at high quality, or converting a photo to PNG, can make it bigger. If the format and dimensions are unchanged and the result is larger, the original is kept. Try 70–80% quality or WebP." },
      { q: "Does it work with iPhone HEIC photos?", a: "Safari on iPhone and Mac can open HEIC photos and convert them to JPG. Other browsers such as Chrome can't open HEIC. Picking photos from the iPhone Photos library usually converts them to JPG automatically, and Settings > Camera > Formats > Most Compatible makes the camera save JPGs." },
      { q: "What happens to photo metadata (EXIF)?", a: "Converted images don't keep metadata such as location, camera or date, so this is also a handy way to strip location data before sharing. Orientation is applied so the photo stays upright." },
    ],
  },
  {
    slug: "watermark-remover",
    category: "Images",
    title: "Watermark Remover (Image & Video)",
    short: "Remove logos, text and date stamps from a chosen area of a photo or video.",
    metaDescription:
      "Free tool to remove watermarks, logos and date stamps from images and videos in your browser. Drag over the area and it is filled in from the surrounding pixels; videos are re-saved with their audio. No upload.",
    intro:
      `Remove a date stamp from your own photo, a channel logo you added to your video, or a mark left by an editing app: anything fixed in one spot. Drag over the area and it is filled in from the surrounding pixels. ${PRIVATE}`,
    howTo: [
      {
        heading: "Selecting the area",
        body: "Choose a file and the image (or a frame of the video) appears. Drag around the watermark to draw a red box; you can select several areas. Make the box a little larger than the watermark, and for watermarks with soft, blurry edges increase 'Edge padding' to 3 or 6 px. Use 'Preview' to check the result first.",
      },
      {
        heading: "How videos are processed",
        body: "The video is played from start to finish, the same areas are filled in on every frame, and it is recorded again with its audio. This takes as long as the video itself, and closing the tab or leaving it in the background for a long time can interrupt it. Output is MP4 or WEBM depending on the browser, and videos larger than 1920 px on the long side are scaled down to 1920 px. If the watermark moves during the video, use the frame slider to find each position and select them all.",
      },
      {
        heading: "When it works well, and when it doesn't",
        body: "Watermarks over sky, walls, plain backgrounds or smooth gradients disappear almost without a trace. Large watermarks over faces, text or detailed textures such as grass can't be redrawn convincingly and may leave a soft smudge. Semi-transparent watermarks repeated across the whole image can't be removed with this tool.",
      },
    ],
    faq: [
      { q: "Can I remove watermarks from other people's photos or videos?", a: "No. A watermark identifies the copyright holder, and removing it to use or share the work without permission may infringe copyright. Use this only on files you created or have permission to edit." },
      { q: "The removed area looks blurry.", a: "The area is filled by blending surrounding colors, so complex backgrounds can look smeared. Fit the box more tightly, or split a large watermark into several smaller boxes for a more natural result." },
      { q: "Video processing seems stuck.", a: "Videos are processed in real time, so a 10-minute video takes about 10 minutes. On phones, processing can stop if the screen turns off or you switch apps; Chrome or Edge on a computer is recommended." },
      { q: "The video is saved as WEBM.", a: "Browsers differ in which formats they can record. If MP4 isn't supported, the result is saved as WEBM, which plays in most video players and can be uploaded to YouTube as is." },
    ],
  },
  {
    slug: "video-trim",
    category: "Video & audio",
    title: "Trim Video",
    short: "Keep only the part of a video you need and save it as MP4 or WEBM.",
    metaDescription:
      "Free online video trimmer that runs in your browser. Fast trimming without re-encoding finishes in seconds at original quality, or trim to the exact frame. No upload.",
    intro:
      `Keep only the scene you need from a long video, or cut the start and end to fit an upload limit. Set a start and end time and only that part is saved as a new file. ${PRIVATE}`,
    howTo: [
      {
        heading: "Choosing the segment",
        body: "Play the video and press 'Set start here' at the first frame you want to keep and 'Set end here' at the last. You can also type times as '83.5' (seconds), '1:23.5' (minutes:seconds) or '1:02:03' (hours:minutes:seconds). 'Play selection' previews just that part.",
      },
      {
        heading: "Fast vs. exact",
        body: "'Fast' copies the needed part without re-encoding, so it finishes in seconds at the original quality. Videos can only start playing from keyframes, which occur every few seconds, so the keyframe just before your start is included and the playback start point is marked separately. Most players start exactly at your chosen time, but some older ones may show a little extra at the beginning. 'Exact' re-encodes the video to cut precisely at your times but takes longer.",
      },
      {
        heading: "Output format",
        body: "'Fast' keeps the original format (MP4 and MOV become MP4, WEBM and MKV stay WEBM). 'Exact' saves H.264 MP4, which opens on almost every device, or WEBM if the browser can't encode MP4.",
      },
    ],
    faq: [
      { q: "The trimmed video starts slightly before my start time.", a: "'Fast' includes the keyframe before your start point, so players or editors that ignore the start marker may show 1-2 extra seconds. Choose 'Exact' if it must be precise everywhere." },
      { q: "Do iPhone videos work?", a: "MOV files (H.264 and HEVC) are supported. Trimming HEVC with 'Exact' requires a browser that can decode HEVC; if it fails, use 'Fast' or try Safari." },
      { q: "Can I also make the file smaller?", a: "Download the trimmed video and open it in Compress Video to lower the resolution and bitrate." },
    ],
  },
  {
    slug: "video-compress",
    category: "Video & audio",
    title: "Compress Video",
    short: "Reduce video file size by lowering resolution and bitrate.",
    metaDescription:
      "Free online video compressor that runs in your browser. Re-encode to 480p, 720p or 1080p with an estimated output size, and remove audio to save even more. No upload.",
    intro:
      `Shrink videos that are too large for messaging apps or email, or that take up too much space on your phone. The video is re-encoded at a smaller size and bitrate. ${PRIVATE}`,
    howTo: [
      {
        heading: "How much to compress",
        body: "'Recommended' (720p) keeps enough quality for phone screens and usually cuts 1080p or 4K phone videos by 70-90%. Choose 'Smallest' (480p) for strict attachment limits, or 'Best quality' (1080p) for videos watched on large screens. If the original is already smaller than the chosen resolution, the size is kept and only the bitrate is lowered.",
      },
      {
        heading: "Estimated size",
        body: "The expected output size is calculated from the video bitrate and length, so the actual result may differ by 10-20%. For screen recordings or lectures that don't need sound, 'Remove audio' saves a bit more.",
      },
      {
        heading: "Speed and browser support",
        body: "It uses the video encoder built into your browser (WebCodecs), so on a computer it's usually faster than the video's length. It works in recent Chrome, Edge, Safari (16.4+) and Firefox. Keep the tab open while it runs.",
      },
    ],
    faq: [
      { q: "The file got bigger.", a: "If the original is already well compressed at a low bitrate, re-encoding may not make it smaller. Keep the original or choose 'Smallest' to lower the resolution further." },
      { q: "The result is saved as WEBM.", a: "If the browser can't encode H.264 (MP4), it saves VP9/VP8 (WEBM). WEBM plays in most video players and can be uploaded to YouTube." },
      { q: "The quality dropped too much.", a: "Choose a higher setting such as 'Best quality'. Dark scenes and fast motion show quality loss more at the same bitrate." },
    ],
  },
  {
    slug: "video-to-gif",
    category: "Video & audio",
    title: "Video to GIF",
    short: "Turn a short part of a video into an animated GIF.",
    metaDescription:
      "Free online video to GIF converter that runs in your browser. Pick the segment, width and frame rate, see the estimated size, and make a GIF instantly. No upload.",
    intro:
      `Make a short, silent, auto-looping clip for chats, forums, blogs or how-to guides. Choose a segment of the video and save it as a GIF. ${PRIVATE}`,
    howTo: [
      {
        heading: "Choosing the segment",
        body: "The first 5 seconds are selected by default. Play the video and press 'Set start here' and 'Set end here', or type the times. A GIF is often more than ten times larger than a video of the same length, so up to 20 seconds can be converted at once.",
      },
      {
        heading: "Width and frame rate",
        body: "A larger width and more frames per second (fps) look sharper and smoother but make the file bigger. For chats, 320-480 px wide at 8-12 fps is plenty; for screen recordings where text must be readable, choose 640 px. The estimated size for your settings is shown below.",
      },
      {
        heading: "GIF limitations",
        body: "A GIF can use only 256 colors per frame, so smooth gradients such as skies may show banding, and it can't carry sound. The GIF loops forever once it reaches the end.",
      },
    ],
    faq: [
      { q: "The GIF is too large.", a: "Shortening the segment helps most, followed by lowering the width and fps. Going from 480 px to 320 px wide cuts the size by more than half." },
      { q: "It doesn't animate when I post it.", a: "Many services have a GIF size limit and show only the first frame when it's exceeded. Staying under about 10 MB is usually safe." },
      { q: "Can I include sound?", a: "The GIF format can't contain sound. If you need sound, make a short video with Trim Video instead." },
    ],
  },
  {
    slug: "video-to-mp3",
    category: "Video & audio",
    title: "Video to MP3",
    short: "Extract the audio from a video and save it as an MP3.",
    metaDescription:
      "Free online tool to extract audio from video as MP3, right in your browser. Choose a segment and save at 128, 192 or 320 kbps. No upload.",
    intro:
      `Listen to a recorded lecture or meeting as audio, or pull the sound from your own video into an editor. Only the audio is saved as an MP3. ${PRIVATE}`,
    howTo: [
      {
        heading: "Choosing the segment",
        body: "The whole video is selected by default, so pressing the button saves all of the audio. If you need only part of it, play the video and press 'Set start here' and 'Set end here', or type the times. 'Whole video' resets the selection.",
      },
      {
        heading: "Choosing the quality",
        body: "MP3 quality is set by how much data is stored per second (kbps). 128 kbps is enough for speech such as lectures and meetings; for music choose 192 kbps (recommended) or 320 kbps. One minute is about 1 MB at 128 kbps and about 2.4 MB at 320 kbps. A higher setting can't make it sound better than the original.",
      },
      {
        heading: "How it works",
        body: "Browsers don't include an MP3 encoder, so this tool downloads one (LAME) the first time and converts inside your browser. On a computer it usually finishes much faster than the video's length.",
      },
    ],
    faq: [
      { q: "It says there is no audio.", a: "The video may have been saved without sound, like many screen recordings, or its audio format can't be read by this browser. If you can hear the video but still see this, try Chrome or Edge." },
      { q: "Can I extract audio from music or other people's videos?", a: "Use it only on videos you made or have rights to. Extracting and sharing audio from other people's music or videos may infringe copyright." },
      { q: "The MP3 won't open on my iPhone.", a: "iPhone saves downloaded MP3s to the Downloads folder in the Files app, where they play when tapped. To add them to the Music library, transfer them with the Music app on a computer." },
    ],
  },
  {
    slug: "video-subtitle",
    category: "Video & audio",
    title: "Extract Subtitles from Video",
    short: "Extract the subtitles inside a video, or transcribe its speech into SRT or VTT subtitles.",
    metaDescription:
      "Free online tool to extract embedded subtitle tracks from MKV, MP4, MOV and WebM videos as SRT, VTT, ASS or TXT, or create subtitles with AI speech recognition (Whisper) right in your browser. No upload.",
    intro:
      `Save the subtitles stored inside a video file (the kind you can turn on and off) as subtitle files. If a video has none, AI listens to the speech and writes subtitles for you, which is handy for turning lectures and meetings into text or captioning your own videos. ${PRIVATE}`,
    howTo: [
      {
        heading: "Which subtitles can be extracted",
        body: "SRT, ASS, SSA and WebVTT subtitles in MKV and WebM, and text subtitles (mov_text, WebVTT) in MP4 and MOV. PGS and VobSub subtitles ripped from Blu-ray or DVD are stored as images, not text, so they can't be extracted, and neither can subtitles burned into the picture.",
      },
      {
        heading: "Choosing a format",
        body: "SRT is read by almost every player and editor. VTT is used on the web (HTML5 video) and for YouTube uploads. If the video has ASS subtitles you can also save them as ASS, keeping fonts, colors and positions. TXT collects just the dialogue without timings.",
      },
      {
        heading: "Creating subtitles from speech",
        body: "If there are no subtitle tracks, choose the spoken language and a mode, then press 'Create subtitles'. OpenAI's Whisper speech recognition model runs inside your browser and transcribes the speech. The AI model (about 100 MB for Faster, 350 MB for More accurate) is downloaded once from Hugging Face and then reused from your browser's storage. In Chrome or Edge with a GPU (WebGPU) it often finishes faster than the video plays; on CPU it can take longer than the video. Up to 60 minutes can be processed at a time.",
      },
      {
        heading: "File names",
        body: "Files are named after the video with a language code, like 'movie.eng.srt'. Put the file next to the video and most players (VLC, mpv and others) load it automatically.",
      },
    ],
    faq: [
      { q: "It says there are no subtitle tracks.", a: "The subtitles are probably burned into the picture, or they came as a separate file (.srt) that your player opened alongside the video. Neither is stored as text inside the video file, so there is nothing to extract." },
      { q: "The speech-recognized subtitles have mistakes.", a: "They're transcribed by AI, so names, technical terms and quiet speech can be misheard. 'More accurate' does better but is larger and slower, and choosing the language instead of auto-detect also helps. You can fix the downloaded SRT in any text or subtitle editor." },
      { q: "Is my video sent anywhere when the AI model downloads?", a: "No. Only the model files are downloaded; the video and audio never leave your browser, and the transcription runs entirely on your device." },
      { q: "Do large files take long?", a: "MP4 and MOV finish quickly because only the index is read. In MKV and WebM the subtitles are spread between the video data, so the whole file is read; a file of several GB can take tens of seconds on a computer." },
      { q: "Can I extract and share subtitles from movies or TV shows?", a: "Use it only on videos you made or have rights to. Subtitles for movies and shows are the work of their translators or studios, so posting extracted subtitles online or sharing them with others may infringe copyright. Keep them for your own study or notes." },
      { q: "The text looks garbled.", a: "Subtitle files are saved as UTF-8 with a BOM. Very old players that can't read UTF-8 may show garbled text; try a current player or an editor that supports SRT and VTT." },
    ],
  },
  {
    slug: "video-subtitle-remove",
    category: "Video & audio",
    title: "Remove Subtitles from Video",
    short: "Remove a video's subtitle tracks, or erase burned-in subtitle text by filling it with surrounding colors.",
    metaDescription:
      "Free online tool to remove subtitle tracks from MKV, MP4, MOV and WebM without re-encoding, and erase hardcoded (burned-in) subtitles by detecting just the text and filling it in. Runs in your browser with no upload.",
    intro:
      `Take out subtitles you added to your own videos, or clear old subtitles before adding new ones in another language. Subtitle tracks you can turn on and off are removed without re-encoding; subtitles burned into the picture are detected and erased frame by frame. ${PRIVATE}`,
    howTo: [
      {
        heading: "Choosing the subtitle type",
        body: "When you choose a file it's first checked for subtitle tracks. If there are any, 'Subtitle tracks' is selected and 'Remove subtitles' creates a copy with the video and audio untouched and the subtitle tracks left out. Nothing is re-encoded, so quality is unchanged and it's quick. If there are no tracks but you still see subtitles, they're burned into the picture: use 'Burned-in subtitles'.",
      },
      {
        heading: "Erasing burned-in subtitles",
        body: "A band at the bottom of the frame is pre-selected. Use the slider to find a frame with subtitles and press 'Preview' to check the result. If subtitles appear elsewhere, press 'Clear all areas' and drag to select new ones (up to 3). Instead of filling the whole area, only text pixels brighter than their outline or shadow are erased, so frames without subtitles stay as they are.",
      },
      {
        heading: "If subtitles aren't fully erased",
        body: "For yellow subtitles set the color to 'Yellow', and for other colors use 'Any bright color'. If text is left behind, raise the sensitivity to 'High'; if traces remain around the letters, increase the edge padding. If bright objects that aren't subtitles get smudged, lower the sensitivity or fit the area tightly to the subtitles. Dark text, or text with no outline on a bright background, is hard to detect.",
      },
      {
        heading: "Processing time and output format",
        body: "Erasing burned-in subtitles changes and re-encodes every frame, so it takes from a few minutes to tens of minutes depending on the video length and your device. Videos larger than 1920px on the long side are scaled down to 1920px, and the output is H.264 MP4 (WEBM if the browser can't make MP4). Removing subtitle tracks keeps the original format (MP4 and MOV become MP4, MKV stays MKV, WEBM stays WEBM).",
      },
    ],
    faq: [
      { q: "The erased area looks blurry.", a: "The text is filled with surrounding colors, so subtitles over faces or detailed textures can leave a smudge. On sky, walls or dark backgrounds they disappear almost without a trace. Keeping sensitivity at 'Normal' or 'Low' erases only the text that's needed and leaves fewer marks." },
      { q: "Things that aren't subtitles get erased too.", a: "Inside the selected area, anything about as bright as the subtitle color and standing out from its surroundings (patterns on white clothes, sign text) can be taken for subtitles. Narrow the area to the subtitle lines and set sensitivity to 'Low'." },
      { q: "I removed the tracks but still see subtitles.", a: "They're either burned into the picture or your player is loading a .srt file from the same folder. Erase burned-in subtitles with 'Burned-in subtitles', and delete or rename the separate subtitle file." },
      { q: "It seems stuck while processing.", a: "Burned-in subtitle removal works on every frame, so progress can be slow. It's faster in Chrome or Edge on a computer than on a phone; keep the tab open while it runs." },
      { q: "Can I remove subtitles from other people's videos?", a: "Use it only on videos you made or have permission to edit. Removing subtitles from movies, shows or other people's videos and re-uploading or sharing them may infringe copyright." },
    ],
  },
  {
    slug: "password-generator",
    category: "Utilities",
    title: "Password Generator",
    short: "Create strong random passwords with the length and characters you choose.",
    metaDescription:
      "Free strong password generator. Choose length and character types (uppercase, lowercase, numbers, symbols) and get random passwords made with your browser's cryptographic random number generator, with a strength (entropy) estimate.",
    intro:
      "Create random passwords that are hard for people to guess, for new accounts or when changing an old password. Passwords are generated in your browser and are never sent or stored anywhere.",
    howTo: [
      {
        heading: "How passwords are generated",
        body: "Each character is picked with your browser's cryptographic random number generator (crypto.getRandomValues). One character from every selected type is chosen first, the rest are filled in, and the whole password is shuffled again. Modulo bias, which would make some characters appear more often, is removed.",
      },
      {
        heading: "What does strength (bits) mean?",
        body: "The strength of a random password is length × log₂(number of possible characters) bits. A 16-character password using lowercase, uppercase, numbers and symbols has about 100 bits, which is practically impossible to guess. Below 40 bits is shown as Weak, below 60 as Fair, below 80 as Strong, and above that as Very strong.",
      },
      {
        heading: "Using passwords safely",
        body: "Making a password longer raises its strength more than adding symbols. Use at least 12 characters, and 16 or more for important accounts. Use a different password for every site, store them in a password manager rather than in notes or messages, and turn on two-factor authentication.",
      },
    ],
    faq: [
      { q: "What if a site doesn't allow symbols?", a: "Turn off symbols and add 2-3 characters to the length to keep a similar strength." },
      { q: "Why exclude similar-looking characters?", a: "It removes characters that are easy to confuse, such as uppercase I, lowercase l and 1, or O and 0, so you make fewer mistakes when typing a password by hand. Strength drops only slightly." },
      { q: "Are generated passwords stored?", a: "No. They are never sent to a server and disappear when you refresh the page. Copy the one you use straight into a password manager." },
    ],
  },
  {
    slug: "qr-code",
    category: "Utilities",
    title: "QR Code Generator",
    short: "Make QR codes for links, text, Wi-Fi and phone numbers, and download PNG or SVG.",
    metaDescription:
      "Free QR code generator for URLs, text, Wi-Fi login, phone calls and SMS. Choose colors, size and error correction, and download PNG or SVG. Codes never expire.",
    intro:
      "Create a QR code for anything you want people to open on their phone: a menu link, an event page, guest Wi-Fi. The information is stored directly in the code, so it never expires and doesn't pass through any redirect server.",
    howTo: [
      {
        heading: "What each type contains",
        body: "'Link / text' stores exactly what you type, adding https:// to addresses that start with www or a domain name. 'Wi-Fi' uses the standard WIFI: format, so phone cameras offer to join the network. 'Phone' opens the dialer, and 'SMS' opens a message with the recipient and text filled in.",
      },
      {
        heading: "Error correction and size",
        body: "Higher error correction lets the code be read even if part of it is covered or dirty, but makes the dots denser. 'Medium' suits screens and clean prints; use 'High' or above for outdoor signs and stickers. For printing, download SVG so it stays sharp at any size, and print it at least 2 cm (about 0.8 in) wide.",
      },
      {
        heading: "Making codes easy to scan",
        body: "Keep the dots dark and the background light with plenty of contrast. Inverted or low-contrast colors can't be read by some cameras. Longer content makes the dots smaller, so shorten long URLs. Test with two or three phones before printing.",
      },
    ],
    faq: [
      { q: "Do the QR codes expire?", a: "No. The link or text is stored in the code itself, so it keeps working even if this site disappears. It stops working only if the web page it points to goes away." },
      { q: "Can I use them commercially?", a: "Yes. You can use the generated images freely on menus, business cards, flyers and more. QR Code is a registered trademark of DENSO WAVE." },
      { q: "Is my Wi-Fi password exposed?", a: "What you enter is turned into a QR code in your browser and never sent to a server. Anyone who scans the code can see the password, though, so a separate guest network is safer." },
    ],
  },
  {
    slug: "saju",
    category: "Personality & fortune",
    title: "Saju Calculator (Korean Four Pillars of Destiny)",
    short: "Enter your birth date and time to see your Korean Saju (Four Pillars) chart, Five Elements, Ten Gods and decade luck, explained in English.",
    metaDescription:
      "Free Korean Saju (Four Pillars of Destiny, BaZi) calculator in English. Get your Year, Month, Day and Hour pillars with hidden stems, Five Elements balance, Ten Gods, combinations and clashes, symbolic stars, and decade and annual luck from your solar or lunar birth date.",
    intro:
      "Saju (사주, 'four pillars') is the Korean form of the Four Pillars of Destiny. Your year, month, day and hour of birth each become a pair of characters (a heavenly stem and an earthly branch), eight in total. This calculator builds your chart from solar term times, then explains your Day Master, the balance of the Five Elements, your Ten Gods, and how your luck changes every 10 years and every year.",
    howTo: [
      {
        heading: "How the chart is calculated",
        body: "The year and month pillars change at the 24 solar terms (the year at Ipchun, around February 4), not on January 1 or the 1st of the month, and are calculated from the exact solar term times. The day pillar follows the 60-day cycle, and the hour pillar uses two-hour periods. Korea's historical daylight saving time and UTC+8:30 periods are applied, and choosing a city corrects for longitude (Seoul is about 32 minutes behind Korea Standard Time).",
      },
      {
        heading: "Day Master and the Ten Gods",
        body: "The stem of your day pillar, the Day Master, represents you. Every other character is read by its relationship to it: Companion (same element), Output (what you produce), Wealth (what you control), Power (what controls you) and Resource (what supports you), each in a yin and yang version, giving ten in total.",
      },
      {
        heading: "Decade and annual luck",
        body: "Decade luck runs forward or backward from your month pillar depending on your sex and the yin or yang of your birth year, and its starting age is based on the time between your birth and the nearest solar term (3 days = 1 year). Annual luck follows each year's pillar, changing at Ipchun.",
      },
    ],
    faq: [
      {
        q: "I was born outside Korea. Can I still use it?",
        a: "Yes. The calculator treats the time you enter as Korean local time, so convert your birth time to Korea Standard Time (UTC+9) first and choose 'No correction'. The chart is the same as long as the moment of birth is the same.",
      },
      {
        q: "Is Saju the same as Chinese BaZi?",
        a: "They share the same system of stems, branches and the Five Elements. This calculator uses Korean readings for the characters (for example Gap for 甲) and common Korean interpretations, so terms and emphasis may differ slightly from BaZi books.",
      },
      {
        q: "What if I don't know my time of birth?",
        a: "Check 'I don't know my time of birth' and the chart is calculated with three pillars, leaving out the hour pillar. Your Day Master, Five Elements and luck are still shown, but the start of decade luck may be off by a few months.",
      },
    ],
    note: "Solar term times and lunar conversion are calculated with lunar-javascript (MIT). Your birth date is never sent to a server or stored. The reading is for entertainment and reference only.",
  },
  {
    slug: "mbti",
    category: "Personality & fortune",
    title: "MBTI Personality Test",
    short: "Answer 32 questions to find your type among the 16 personalities, with percentages and a full description.",
    metaDescription:
      "Free 32-question MBTI-style personality test. See your scores on Extraversion-Introversion, Sensing-Intuition, Thinking-Feeling and Judging-Perceiving, plus strengths, weaknesses, careers, relationships and compatible types for all 16 types. No sign-up.",
    intro:
      "Read each statement and choose how much it sounds like you on a five-point scale. The test works out your four preferences and tells you which of the 16 personality types you are, how strongly you lean on each side, and what your type is like at work and in relationships.",
    howTo: [
      {
        heading: "The four preferences",
        body: "The test looks at where you get your energy (E Extraversion, I Introversion), how you take in information (S Sensing, N Intuition), how you make decisions (T Thinking, F Feeling) and how you approach life (J Judging, P Perceiving). The letter you lean toward on each one makes up your four-letter type, such as ENFP or ISTJ.",
      },
      {
        heading: "How it is scored",
        body: "There are 8 questions per preference, 32 in total, and half of each set describes one side and half the other. Answers from 'Strongly disagree' to 'Strongly agree' count from -2 to +2 and are turned into a percentage. An exact 50% tie goes to the first letter (E, S, T or J).",
      },
      {
        heading: "Tips for answering",
        body: "Pick the answer closest to how you usually are, not how you'd like to be. Don't overthink it: your first instinct tends to be more accurate.",
      },
    ],
    faq: [
      {
        q: "Is this the official MBTI assessment?",
        a: "No. The official MBTI® is a paid assessment provided by certified practitioners. This is a short quiz we wrote based on the 16 personality types theory, so results may differ.",
      },
      {
        q: "Why does my result change when I retake it?",
        a: "Preferences close to 50% can flip depending on your mood or situation that day. The result page points out which ones are close, which simply means you use both sides.",
      },
      {
        q: "Are my answers saved or sent anywhere?",
        a: "No. Everything is calculated in your browser and nothing is sent to a server or stored. If you share your result link, it only contains your type and percentages.",
      },
    ],
    note: "This is a short quiz, not the official MBTI® assessment, and the result is for fun and self-reflection. Your answers are never sent to a server or stored.",
  },
];

export const getToolEn = (slug: string) => toolsEn.find((t) => t.slug === slug);

export const enGroups = EN_CATEGORIES.map((category) => ({
  category,
  items: toolsEn.filter((t) => t.category === category).map((t) => ({ href: `/en/tools/${t.slug}`, title: t.title, short: t.short })),
}));
