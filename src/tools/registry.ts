import type { Tool } from '../types';

// PDF Tools
import mergePdf        from './pdf/mergePdf';
import splitPdf        from './pdf/splitPdf';
import extractPagesPdf from './pdf/extractPagesPdf';
import removePdfPages  from './pdf/removePdfPages';
import rotatePdf       from './pdf/rotatePdf';
import watermarkPdf    from './pdf/watermarkPdf';
import pageNumbersPdf  from './pdf/pageNumbersPdf';
import compressPdf     from './pdf/compressPdf';
import pdfToImage      from './pdf/pdfToImage';
import pdfToText       from './pdf/pdfToText';
import pdfMetadata     from './pdf/pdfMetadata';
import pdfReorderPages from './pdf/pdfReorderPages';
import pdfAddBlank     from './pdf/pdfAddBlank';
import pdfResizePage   from './pdf/pdfResizePage';
// pdfLock and pdfUnlock removed — pdf-lib does not support encryption

// Image Tools
import imageConvert   from './image/imageConvert';
import imageCompress  from './image/imageCompress';
import imageResize    from './image/imageResize';
import imageRotate    from './image/imageRotate';
import imageFlip      from './image/imageFlip';
import imageWatermark from './image/imageWatermark';
import imageFilters   from './image/imageFilters';
import imageGrayscale from './image/imageGrayscale';
import imageAddBg     from './image/imageAddBg';
import imageMerge     from './image/imageMerge';
import stripMetadata  from './image/stripMetadata';
import imageToPdf     from './image/imageToPdf';
import imageToBase64  from './image/imageToBase64';
import colorPalette   from './image/colorPalette';
import imageCrop      from './image/imageCrop';
import imageCollage   from './image/imageCollage';

const tools: Tool[] = [
  // PDF
  mergePdf,
  splitPdf,
  extractPagesPdf,
  removePdfPages,
  rotatePdf,
  watermarkPdf,
  pageNumbersPdf,
  compressPdf,
  pdfToImage,
  pdfToText,
  pdfMetadata,
  pdfReorderPages,
  pdfAddBlank,
  pdfResizePage,
  // Image
  imageConvert,
  imageCompress,
  imageResize,
  imageRotate,
  imageFlip,
  imageWatermark,
  imageFilters,
  imageGrayscale,
  imageAddBg,
  imageMerge,
  stripMetadata,
  imageToPdf,
  imageToBase64,
  colorPalette,
  imageCrop,
  imageCollage,
];

export function getAllTools(): Tool[] { return tools; }

export function getToolById(id: string): Tool | undefined {
  return tools.find((t) => t.id === id);
}

export function getToolsByCategory(category: Tool['category']): Tool[] {
  return tools.filter((t) => t.category === category);
}

export const categories: { id: Tool['category']; label: string; short: string }[] = [
  { id: 'pdf',   label: 'PDF Tools',   short: 'PDF'   },
  { id: 'image', label: 'Image Tools', short: 'IMAGE' },
];
