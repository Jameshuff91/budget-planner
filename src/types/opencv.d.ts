/**
 * Type definitions for OpenCV.js
 */

declare global {
  interface Window {
    cv: typeof cv;
  }

  const cv: {
    // Mat operations
    Mat: new () => Mat;
    MatVector: new () => MatVector;
    matFromImageData(imageData: ImageData): Mat;

    // Color conversion
    cvtColor(src: Mat, dst: Mat, code: number): void;
    COLOR_RGBA2GRAY: number;
    COLOR_BGR2GRAY: number;
    COLOR_GRAY2BGR: number;

    // Thresholding
    threshold(src: Mat, dst: Mat, thresh: number, maxval: number, type: number): void;
    THRESH_BINARY: number;
    THRESH_BINARY_INV: number;
    THRESH_OTSU: number;

    // Contours
    findContours(
      image: Mat,
      contours: MatVector,
      hierarchy: Mat,
      mode: number,
      method: number
    ): void;
    RETR_EXTERNAL: number;
    RETR_LIST: number;
    RETR_TREE: number;
    CHAIN_APPROX_SIMPLE: number;
    CHAIN_APPROX_NONE: number;

    // Geometric transformations
    minAreaRect(points: Mat): RotatedRect;
    getRotationMatrix2D(center: Point, angle: number, scale: number): Mat;
    warpAffine(src: Mat, dst: Mat, M: Mat, dsize: Size, flags?: number): void;
    INTER_LINEAR: number;
    INTER_CUBIC: number;

    // Data structures
    Point: new (x: number, y: number) => Point;
    Size: new (width: number, height: number) => Size;
    Scalar: new (v0: number, v1?: number, v2?: number, v3?: number) => Scalar;

    // Image processing
    imread(imageSource: HTMLImageElement | HTMLCanvasElement): Mat;
    imshow(canvasSource: string | HTMLCanvasElement, mat: Mat): void;

    // Morphological operations
    morphologyEx(src: Mat, dst: Mat, op: number, kernel: Mat): void;
    getStructuringElement(shape: number, ksize: Size): Mat;
    MORPH_RECT: number;
    MORPH_ELLIPSE: number;
    MORPH_OPEN: number;
    MORPH_CLOSE: number;
    MORPH_GRADIENT: number;

    // Other utilities
    boundingRect(points: Mat): Rect;
    contourArea(contour: Mat): number;
  };

  interface Mat {
    rows: number;
    cols: number;
    data: Uint8Array;
    delete(): void;
    size(): Size;
    clone(): Mat;
    copyTo(dst: Mat): void;
  }

  interface MatVector {
    size(): number;
    get(index: number): Mat;
    push_back(mat: Mat): void;
    delete(): void;
  }

  interface Point {
    x: number;
    y: number;
  }

  interface Size {
    width: number;
    height: number;
  }

  interface Scalar {
    [index: number]: number;
  }

  interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface RotatedRect {
    center: Point;
    size: Size;
    angle: number;
  }
}

export {};
