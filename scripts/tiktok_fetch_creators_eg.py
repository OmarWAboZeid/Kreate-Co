import argparse
import asyncio
import csv
import json
import os
import sys
import traceback
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import urlparse

from TikTokApi import TikTokApi


EGYPT_KEYWORDS = [
    "egypt",
    "egyptian",
    "cairo",
    "alexandria",
    "giza",
    "zagazig",
    "mansoura",
    "tanta",
    "aswan",
    "luxor",
    "sohag",
    "ismailia",
    "port said",
    "portsaid",
    "suez",
    "fayoum",
    "sharm",
    "sharm el sheikh",
    "hurghada",
    "dahab",
    "minya",
    "beni suef",
    "banha",
    "damietta",
    "mallawi",
    "el mahalla",
    "kafr",
    "matrouh",
    "qena",
    "asyut",
]

EGYPT_KEYWORDS_AR = [
    "مصر",
    "مصري",
    "مصرية",
    "القاهرة",
    "الجيزة",
    "جيزة",
    "الإسكندرية",
    "اسكندرية",
    "سوهاج",
    "أسوان",
    "اسوان",
    "الأقصر",
    "الاقصر",
    "الغردقة",
    "شرم",
    "الفيوم",
    "الإسماعيلية",
    "الاسماعيلية",
    "بورسعيد",
    "دمياط",
    "المنيا",
    "بنها",
    "أسيوط",
    "اسيوط",
    "قنا",
    "مطروح",
]

EGYPT_REGION_CODES = {"eg", "egy", "egypt"}

DEFAULT_QUERIES = [
    "Egypt",
    "Egyptian",
    "Cairo",
    "Alexandria",
    "مصر",
    "القاهرة",
    "الإسكندرية",
]

DEFAULT_HASHTAGS = [
    "egypt",
    "egyptian",
    "cairo",
    "alexandria",
    "مصر",
    "القاهرة",
    "الإسكندرية",
]


def _get_ms_token() -> str:
    return os.environ.get("ms_token") or os.environ.get("MS_TOKEN") or ""


def _lower(value: Optional[str]) -> str:
    return (value or "").lower()


def _extract_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(str(value).replace(",", ""))
    except Exception:
        return None


def _collect_text_fields(fields: Iterable[Optional[str]]) -> str:
    return " ".join([value for value in fields if value])


def _region_is_egypt(region: str) -> bool:
    return _lower(region) in EGYPT_REGION_CODES


def _find_location_hint(text: str) -> str:
    lowered = _lower(text)
    for keyword in EGYPT_KEYWORDS:
        if keyword in lowered:
            return keyword
    for keyword in EGYPT_KEYWORDS_AR:
        if keyword in text:
            return keyword
    return ""


def _is_egypt_candidate(text: str, region: str, source_hint: str, allow_source: bool) -> bool:
    lowered = _lower(text)
    region_lower = _lower(region)
    if region_lower in EGYPT_REGION_CODES:
        return True
    if allow_source and source_hint:
        return True
    for keyword in EGYPT_KEYWORDS:
        if keyword in lowered:
            return True
    for keyword in EGYPT_KEYWORDS_AR:
        if keyword in text:
            return True
    return False


def _extract_user_fields(
    user_dict: Dict[str, Any],
) -> Tuple[str, str, str, Optional[int], str, Optional[int]]:
    user = user_dict.get("user") or user_dict.get("author") or user_dict or {}
    stats = user_dict.get("stats") or user_dict.get("authorStats") or user_dict.get("authorStatsV2") or {}
    username = user.get("uniqueId") or user.get("unique_id") or user.get("username") or ""
    name = user.get("nickname") or user.get("displayName") or user.get("name") or ""
    signature = user.get("signature") or user.get("bio") or user.get("desc") or ""
    region = user.get("region") or user.get("regionCode") or user.get("region_code") or ""
    followers = (
        _extract_int(stats.get("followerCount"))
        or _extract_int(stats.get("followers"))
        or _extract_int(stats.get("followers_count"))
    )
    video_count = _extract_int(stats.get("videoCount")) or _extract_int(stats.get("video_count"))
    return username, name, signature, followers, region, video_count


def _extract_from_user_info(
    info: Dict[str, Any],
) -> Tuple[str, str, str, Optional[int], str, Optional[int]]:
    user_info = info.get("userInfo") or {}
    user = user_info.get("user") or info.get("user") or {}
    stats = user_info.get("stats") or info.get("stats") or {}
    username = user.get("uniqueId") or user.get("unique_id") or user.get("username") or ""
    name = user.get("nickname") or user.get("displayName") or user.get("name") or ""
    signature = user.get("signature") or user.get("bio") or user.get("desc") or ""
    region = user.get("region") or user.get("regionCode") or user.get("region_code") or ""
    followers = _extract_int(stats.get("followerCount")) or _extract_int(stats.get("followers"))
    video_count = _extract_int(stats.get("videoCount")) or _extract_int(stats.get("video_count"))
    return username, name, signature, followers, region, video_count


def _profile_url(username: str) -> str:
    return f"https://www.tiktok.com/@{username}"


def _parse_proxy(value: str) -> Optional[Dict[str, str]]:
    if not value:
        return None
    raw = value.strip()
    if "://" not in raw:
        raw = f"http://{raw}"
    parsed = urlparse(raw)
    if not parsed.hostname:
        raise SystemExit("Invalid --proxy value. Expected host:port or scheme://user:pass@host:port")
    server = f"{parsed.scheme}://{parsed.hostname}"
    if parsed.port:
        server = f"{server}:{parsed.port}"
    proxy: Dict[str, str] = {"server": server}
    if parsed.username:
        proxy["username"] = parsed.username
    if parsed.password:
        proxy["password"] = parsed.password
    return proxy


def _limit_reached(current: int, limit: int) -> bool:
    return limit > 0 and current >= limit


async def run(args: argparse.Namespace) -> None:
    ms_token = _get_ms_token()
    if not ms_token:
        raise SystemExit(
            "Missing ms_token. Set env var ms_token or MS_TOKEN from your tiktok.com cookies."
        )

    sys.stderr.write("Starting TikTok creator discovery...\n")
    sys.stderr.write(f"Python: {sys.version.split()[0]}\n")
    sys.stderr.write(f"Browser: {args.browser}\n")
    sys.stderr.write(f"Headless: {args.headless}\n")
    sys.stderr.write(f"ms_token length: {len(ms_token)}\n")

    if args.no_defaults:
        queries = args.queries
        hashtags = args.hashtags
    else:
        queries = args.queries or DEFAULT_QUERIES
        hashtags = args.hashtags or DEFAULT_HASHTAGS
    max_creators = args.max_creators
    search_limit = args.search_count if args.search_count > 0 else 10**9
    hashtag_limit = args.hashtag_videos if args.hashtag_videos > 0 else 10**9
    proxy = _parse_proxy(args.proxy)
    proxies = [proxy] if proxy else None

    creators: Dict[str, Dict[str, Any]] = {}
    sources: Dict[str, Set[str]] = {}
    total_discovered = 0
    total_filtered_out = 0

    async with TikTokApi() as api:
        sys.stderr.write("Creating TikTokApi session...\n")
        await api.create_sessions(
            ms_tokens=[ms_token],
            num_sessions=args.sessions,
            sleep_after=args.sleep_after,
            browser=args.browser,
            headless=args.headless,
            proxies=proxies,
            timeout=args.timeout,
        )
        sys.stderr.write("Session created.\n")

        async def add_creator(
            username: str,
            name: str,
            signature: str,
            followers: Optional[int],
            region: str,
            video_count: Optional[int],
            source_hint: str,
        ) -> bool:
            nonlocal total_discovered, total_filtered_out
            if not username:
                return False
            total_discovered += 1
            text_blob = _collect_text_fields([username, name, signature])
            if args.require_region and not _region_is_egypt(region):
                total_filtered_out += 1
                return False

            is_egypt = _is_egypt_candidate(
                text_blob,
                region,
                source_hint,
                allow_source=not args.strict_filter,
            )
            if args.strict_filter and not is_egypt:
                total_filtered_out += 1
                return False

            entry = creators.get(username)
            if not entry:
                location_hint = _find_location_hint(text_blob)
                creators[username] = {
                    "name": name or "",
                    "username": username,
                    "profile_url": _profile_url(username),
                    "followers": followers,
                    "signature": signature or "",
                    "region": region or "",
                    "video_count": video_count,
                    "location_hint": location_hint,
                    "location_source": "region" if region else ("bio" if location_hint else ""),
                }
                sources[username] = {source_hint} if source_hint else set()
                return True

            if name and not entry.get("name"):
                entry["name"] = name
            if signature and not entry.get("signature"):
                entry["signature"] = signature
            if region and not entry.get("region"):
                entry["region"] = region
            if followers is not None and (entry.get("followers") is None):
                entry["followers"] = followers
            if video_count is not None and (entry.get("video_count") is None):
                entry["video_count"] = video_count
            if not entry.get("location_source"):
                location_hint = _find_location_hint(text_blob)
                if region:
                    entry["location_source"] = "region"
                elif location_hint:
                    entry["location_source"] = "bio"
                if location_hint and not entry.get("location_hint"):
                    entry["location_hint"] = location_hint
            if source_hint:
                sources.setdefault(username, set()).add(source_hint)
            return False

        async def harvest_search(query: str) -> None:
            sys.stderr.write(f"Searching users for: {query}\n")
            try:
                async for user in api.search.users(query, count=search_limit):
                    user_dict = user.as_dict if hasattr(user, "as_dict") else {}
                    username, name, signature, followers, region, video_count = _extract_user_fields(
                        user_dict
                    )
                    added = await add_creator(
                        username,
                        name,
                        signature,
                        followers,
                        region,
                        video_count,
                        source_hint=f"search:{query}",
                    )
                    if added and _limit_reached(len(creators), max_creators):
                        return
            except Exception as exc:  # noqa: BLE001
                sys.stderr.write(f"Search error for {query}: {exc}\n")
                sys.stderr.write(traceback.format_exc())

        async def harvest_hashtag(tag: str) -> None:
            sys.stderr.write(f"Fetching hashtag videos: {tag}\n")
            try:
                hashtag = api.hashtag(name=tag)
                async for video in hashtag.videos(count=hashtag_limit):
                    video_dict = video.as_dict if hasattr(video, "as_dict") else {}
                    username, name, signature, followers, region, video_count = _extract_user_fields(
                        video_dict
                    )
                    added = await add_creator(
                        username,
                        name,
                        signature,
                        followers,
                        region,
                        video_count,
                        source_hint=f"hashtag:{tag}",
                    )
                    if added and _limit_reached(len(creators), max_creators):
                        return
            except Exception as exc:  # noqa: BLE001
                sys.stderr.write(f"Hashtag error for {tag}: {exc}\n")
                sys.stderr.write(traceback.format_exc())

        for query in queries:
            await harvest_search(query)
            sys.stderr.write(f"Creators collected so far: {len(creators)}\n")
            if _limit_reached(len(creators), max_creators):
                break

        for tag in hashtags:
            if _limit_reached(len(creators), max_creators):
                break
            await harvest_hashtag(tag)
            sys.stderr.write(f"Creators collected so far: {len(creators)}\n")

        if args.fetch_info:
            sys.stderr.write("Fetching user info for missing details...\n")
            for username, entry in list(creators.items()):
                needs_info = entry.get("followers") is None
                if args.include_details:
                    if not entry.get("signature") or entry.get("video_count") is None:
                        needs_info = True
                if args.include_location and not entry.get("region"):
                    needs_info = True
                if not needs_info:
                    continue
                try:
                    info = await api.user(username=username).info()
                    u_name, name, signature, followers, region, video_count = _extract_from_user_info(
                        info
                    )
                    if name and not entry.get("name"):
                        entry["name"] = name
                    if signature and not entry.get("signature"):
                        entry["signature"] = signature
                    if region and not entry.get("region"):
                        entry["region"] = region
                        entry["location_source"] = entry.get("location_source") or "region"
                    if signature and not entry.get("location_hint"):
                        entry["location_hint"] = _find_location_hint(signature)
                        if entry.get("location_hint") and not entry.get("location_source"):
                            entry["location_source"] = "bio"
                    if followers is not None:
                        entry["followers"] = followers
                    if video_count is not None:
                        entry["video_count"] = video_count
                except Exception as exc:  # noqa: BLE001
                    sys.stderr.write(f"User info error for {username}: {exc}\n")
                if args.info_sleep > 0:
                    await asyncio.sleep(args.info_sleep)

    results = list(creators.values())
    sys.stderr.write(
        f"Discovery summary: discovered={total_discovered}, "
        f"kept={len(results)}, filtered_out={total_filtered_out}\n"
    )
    if args.min_followers > 0:
        results = [row for row in results if (row.get("followers") or 0) >= args.min_followers]

    results.sort(key=lambda row: row.get("followers") or 0, reverse=True)

    if not args.no_csv:
        output_path = args.output
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        with open(output_path, "w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["name", "username", "profile_url", "followers_count"])
            for row in results:
                writer.writerow(
                    [
                        row.get("name") or "",
                        row.get("username") or "",
                        row.get("profile_url") or "",
                        row.get("followers") if row.get("followers") is not None else "",
                    ]
                )
        sys.stderr.write(f"Wrote CSV: {output_path}\n")
    else:
        sys.stderr.write("CSV output skipped (--no-csv).\n")

    if args.json_output:
        if args.json_output in {"-", "stdout"}:
            print(json.dumps(results, ensure_ascii=False))
            sys.stderr.write("Wrote JSON to stdout.\n")
        else:
            with open(args.json_output, "w", encoding="utf-8") as handle:
                json.dump(results, handle, ensure_ascii=False, indent=2)
            sys.stderr.write(f"Wrote JSON: {args.json_output}\n")


def _parse_list(value: str) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Discover Egypt-based TikTok creators")
    parser.add_argument("--queries", type=_parse_list, default=[])
    parser.add_argument("--hashtags", type=_parse_list, default=[])
    parser.add_argument("--search-count", type=int, default=25)
    parser.add_argument("--hashtag-videos", type=int, default=25)
    parser.add_argument("--max-creators", type=int, default=200)
    parser.add_argument("--min-followers", type=int, default=0)
    parser.add_argument("--output", type=str, default="data/egypt_creators.csv")
    parser.add_argument("--json-output", type=str, default="")
    parser.add_argument("--no-csv", action="store_true")
    parser.add_argument("--fetch-info", action="store_true", dest="fetch_info")
    parser.add_argument("--no-fetch-info", action="store_false", dest="fetch_info")
    parser.set_defaults(fetch_info=True)
    parser.add_argument("--info-sleep", type=float, default=0.3)
    parser.add_argument("--strict-filter", action="store_true")
    parser.add_argument("--require-region", action="store_true")
    parser.add_argument("--include-location", action="store_true")
    parser.add_argument("--include-details", action="store_true")
    parser.add_argument("--no-defaults", action="store_true")
    parser.add_argument("--browser", type=str, default=os.getenv("TIKTOK_BROWSER", "chromium"))
    parser.add_argument("--headless", action="store_true", dest="headless")
    parser.add_argument("--no-headless", action="store_false", dest="headless")
    parser.set_defaults(headless=True)
    parser.add_argument("--sessions", type=int, default=1)
    parser.add_argument("--sleep-after", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=30000)
    parser.add_argument("--proxy", type=str, default="")
    return parser


if __name__ == "__main__":
    asyncio.run(run(build_parser().parse_args()))
