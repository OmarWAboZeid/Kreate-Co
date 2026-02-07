import argparse
import asyncio
import csv
import json
import os
import sys
import traceback
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from TikTokApi import TikTokApi


DEFAULT_QUERIES = ["egypt", "cairo", "مصر", "egyptian", "alexandria", "hurghada"]


def _get_ms_token() -> str:
    return "dE5R_feWb6MHirWNgn6nrGkW20fo4ZcfaMHMkjeBREi60qQD4AQ8oqkySGQ1c4Gobj4f6ZALTDy9zAUy2706sIO4LP1jFJTzh0zfujWCOaa-d01B06zWQPe-wBVDsVl-GStKF5X3CC4vF8CYEmVeNnk8"


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


def _extract_from_user_info(
    info: Dict[str, Any],
) -> Tuple[str, str, str, Optional[int], str, Optional[int], str, str]:
    user_info = info.get("userInfo") or {}
    user = user_info.get("user") or info.get("user") or {}
    stats = user_info.get("stats") or info.get("stats") or {}
    username = user.get("uniqueId") or user.get("unique_id") or user.get("username") or ""
    name = user.get("nickname") or user.get("displayName") or user.get("name") or ""
    bio = user.get("signature") or user.get("bio") or user.get("desc") or ""
    region = user.get("region") or user.get("regionCode") or user.get("region_code") or ""
    followers = _extract_int(stats.get("followerCount")) or _extract_int(stats.get("followers"))
    video_count = _extract_int(stats.get("videoCount")) or _extract_int(stats.get("video_count"))
    sec_uid = user.get("secUid") or user.get("sec_uid") or ""
    user_id = user.get("id") or user.get("user_id") or ""
    return username, name, bio, followers, region, video_count, sec_uid, user_id


def _parse_list(value: str) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _limit_reached(current: int, limit: int) -> bool:
    return limit > 0 and current >= limit


async def run(args: argparse.Namespace) -> None:
    ms_token = _get_ms_token()
    if not ms_token:
        raise SystemExit(
            "Missing ms_token. Set env var ms_token or MS_TOKEN from your tiktok.com cookies."
        )

    sys.stderr.write("Starting TikTok search scrape...\n")
    sys.stderr.write(f"Python: {sys.version.split()[0]}\n")
    sys.stderr.write(f"Browser: {args.browser}\n")
    sys.stderr.write(f"Headless: {args.headless}\n")
    sys.stderr.write(f"ms_token length: {len(ms_token)}\n")

    if args.no_defaults:
        queries = args.queries
    else:
        queries = args.queries or DEFAULT_QUERIES
    search_limit = args.search_count if args.search_count > 0 else 10**9
    max_creators = args.max_creators
    proxy = _parse_proxy(args.proxy)
    proxies = [proxy] if proxy else None

    creators: Dict[str, Dict[str, Any]] = {}

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

        async def add_user(user_obj: Any, source_hint: str) -> bool:
            username = getattr(user_obj, "username", None) or ""
            if not username:
                user_dict = getattr(user_obj, "as_dict", {}) or {}
                user_info = user_dict.get("user") or user_dict.get("user_info") or {}
                username = user_info.get("uniqueId") or user_info.get("unique_id") or ""
            if not username:
                return False

            entry = creators.get(username)
            sec_uid = getattr(user_obj, "sec_uid", None)
            user_id = getattr(user_obj, "user_id", None)
            if not entry:
                creators[username] = {
                    "name": "",
                    "username": username,
                    "profile_url": _profile_url(username),
                    "followers": None,
                    "region": "",
                    "bio": "",
                    "videos": None,
                    "sec_uid": sec_uid or "",
                    "user_id": user_id or "",
                    "sources": {source_hint} if source_hint else set(),
                }
                return True

            if sec_uid and not entry.get("sec_uid"):
                entry["sec_uid"] = sec_uid
            if user_id and not entry.get("user_id"):
                entry["user_id"] = user_id
            if source_hint:
                entry.setdefault("sources", set()).add(source_hint)
            return False

        for query in queries:
            sys.stderr.write(f"Searching users for: {query}\n")
            try:
                async for user in api.search.users(query, count=search_limit):
                    added = await add_user(user, source_hint=f"search:{query}")
                    if added and _limit_reached(len(creators), max_creators):
                        break
                if _limit_reached(len(creators), max_creators):
                    break
            except Exception as exc:  # noqa: BLE001
                sys.stderr.write(f"Search error for {query}: {exc}\n")
                sys.stderr.write(traceback.format_exc())

        if args.fetch_info:
            sys.stderr.write("Fetching user info for details...\n")
            for username, entry in list(creators.items()):
                needs_info = entry.get("followers") is None or not entry.get("bio") or entry.get("videos") is None
                if not needs_info:
                    continue
                try:
                    info = await api.user(
                        username=username,
                        sec_uid=entry.get("sec_uid") or None,
                        user_id=entry.get("user_id") or None,
                    ).info()
                    (
                        info_username,
                        name,
                        bio,
                        followers,
                        region,
                        video_count,
                        sec_uid,
                        user_id,
                    ) = _extract_from_user_info(info)
                    if info_username and info_username != username:
                        creators.setdefault(info_username, creators.pop(username, entry))
                        entry = creators[info_username]
                        entry["username"] = info_username
                        entry["profile_url"] = _profile_url(info_username)
                    if name:
                        entry["name"] = name
                    if bio:
                        entry["bio"] = bio
                    if followers is not None:
                        entry["followers"] = followers
                    if region:
                        entry["region"] = region
                    if video_count is not None:
                        entry["videos"] = video_count
                    if sec_uid and not entry.get("sec_uid"):
                        entry["sec_uid"] = sec_uid
                    if user_id and not entry.get("user_id"):
                        entry["user_id"] = user_id
                except Exception as exc:  # noqa: BLE001
                    sys.stderr.write(f"User info error for {username}: {exc}\n")
                if args.info_sleep > 0:
                    await asyncio.sleep(args.info_sleep)

    results = list(creators.values())
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Fetch all creators from TikTok search results"
    )
    parser.add_argument("--queries", type=_parse_list, default=[])
    parser.add_argument("--search-count", type=int, default=0)
    parser.add_argument("--max-creators", type=int, default=0)
    parser.add_argument("--min-followers", type=int, default=0)
    parser.add_argument("--output", type=str, default="data/egypt_creators_search_all.csv")
    parser.add_argument("--json-output", type=str, default="")
    parser.add_argument("--no-csv", action="store_true")
    parser.add_argument("--fetch-info", action="store_true", dest="fetch_info")
    parser.add_argument("--no-fetch-info", action="store_false", dest="fetch_info")
    parser.set_defaults(fetch_info=True)
    parser.add_argument("--info-sleep", type=float, default=0.3)
    parser.add_argument("--browser", type=str, default=os.getenv("TIKTOK_BROWSER", "chromium"))
    parser.add_argument("--headless", action="store_true", dest="headless")
    parser.add_argument("--no-headless", action="store_false", dest="headless")
    parser.set_defaults(headless=True)
    parser.add_argument("--sessions", type=int, default=1)
    parser.add_argument("--sleep-after", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=30000)
    parser.add_argument("--proxy", type=str, default="")
    parser.add_argument("--no-defaults", action="store_true")
    return parser


if __name__ == "__main__":
    asyncio.run(run(build_parser().parse_args()))
