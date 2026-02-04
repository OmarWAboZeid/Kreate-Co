import re


def parse_followers(value):
    if not value:
        return None
    value = str(value).strip()
    return value


def extract_tiktok_handle(url):
    if not url:
        return None
    match = re.search(r'tiktok\\.com/@([^?/]+)', str(url))
    return f"@{match.group(1)}" if match else None


def extract_instagram_handle(url):
    if not url:
        return None
    match = re.search(r'instagram\\.com/([^?/]+)', str(url))
    return f"@{match.group(1)}" if match else None
