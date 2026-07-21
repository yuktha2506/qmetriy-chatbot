from PIL import Image, ImageEnhance, ImageFilter, ImageOps

try:
    RESAMPLE_FILTER = Image.Resampling.LANCZOS
except AttributeError:
    RESAMPLE_FILTER = Image.LANCZOS


def resize_image(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    resized = image.copy()
    resized.thumbnail((max_width, max_height), RESAMPLE_FILTER)
    return resized


def convert_to_grayscale(image: Image.Image) -> Image.Image:
    return ImageOps.grayscale(image)


def reduce_noise(image: Image.Image) -> Image.Image:
    return image.filter(ImageFilter.MedianFilter(size=3))


def enhance_contrast(image: Image.Image, factor: float = 1.6) -> Image.Image:
    return ImageEnhance.Contrast(image).enhance(factor)


def sharpen_image(image: Image.Image, factor: float = 1.2) -> Image.Image:
    return ImageEnhance.Sharpness(image).enhance(factor)


def normalize_for_ocr(image: Image.Image) -> Image.Image:
    normalized = ImageOps.autocontrast(image)
    return normalized.filter(ImageFilter.SHARPEN)


def preprocess_for_ocr(
    image: Image.Image,
    max_width: int,
    max_height: int,
    contrast_factor: float = 1.6,
    sharpness_factor: float = 1.2,
) -> Image.Image:
    processed = resize_image(image, max_width, max_height)
    processed = convert_to_grayscale(processed)
    processed = reduce_noise(processed)
    processed = enhance_contrast(processed, contrast_factor)
    processed = sharpen_image(processed, sharpness_factor)
    processed = normalize_for_ocr(processed)
    return processed
