import { describeProductFileDetails, type ProductFile } from "../../domain/listings/instantDownloads";
import type { Translate } from "../../lib/i18n/i18n";
import { formatFileSize } from "../../lib/listings/deliveryFiles";

// "2.1 MB · 1920 × 1080 px", the line shown under a file's name.
export const productFileMeta = (file: ProductFile, t: Translate): string =>
  [
    formatFileSize(file.size_bytes, t),
    ...describeProductFileDetails(file.details, t, (bytes) => formatFileSize(bytes, t)),
  ].join(" · ");
