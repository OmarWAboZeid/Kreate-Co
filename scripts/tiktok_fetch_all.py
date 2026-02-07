import argparse
import asyncio
import json
import os
import sys
import traceback
from urllib.parse import urlparse
from typing import Any, Dict

from TikTokApi import TikTokApi


def _get_ms_token() -> str:
    return os.environ.get("ms_token") or os.environ.get("MS_TOKEN") or ""


def _summarize(obj: Any) -> Dict[str, Any]:
    if isinstance(obj, dict):
        return {
            "keys": sorted(obj.keys()),
            "sample": obj,
        }
    return {"value": obj}


async def run(args: argparse.Namespace) -> None:
    ms_token = _get_ms_token()
    if not ms_token:
        raise SystemExit(
            "Missing ms_token. Set env var ms_token or MS_TOKEN from your tiktok.com cookies."
        )

    sys.stderr.write("Starting TikTok scrape...\n")
    sys.stderr.write(f"Python: {sys.version.split()[0]}\n")
    sys.stderr.write(f"Browser: {os.getenv('TIKTOK_BROWSER', 'chromium')}\n")
    sys.stderr.write(f"ms_token length: {len(ms_token)}\n")

    if args.profile_url and not args.username:
        parsed = urlparse(args.profile_url)
        path = parsed.path or ""
        if path.startswith("/@"):
            args.username = path.split("/@")[1].split("/")[0]
        if not args.username:
            raise SystemExit("Could not extract username from profile URL.")

    results: Dict[str, Any] = {
        "trending": [],
        "search_users": [],
        "user": {},
        "hashtag": {},
        "sound": {},
        "video": {},
    }

    async with TikTokApi() as api:
        sys.stderr.write("Creating TikTokApi session...\n")
        try:
            await api.create_sessions(
                ms_tokens=[ms_token],
                num_sessions=1,
                sleep_after=3,
                browser=os.getenv("TIKTOK_BROWSER", "chromium"),
            )
            sys.stderr.write("Session created.\n")
        except Exception as exc:  # noqa: BLE001
            results["session_error"] = str(exc)
            results["session_trace"] = traceback.format_exc()
            sys.stderr.write(f"Session creation failed: {exc}\n")
            output = {
                "counts": {
                    "trending": 0,
                    "search_users": 0,
                    "user_videos": 0,
                    "user_liked": 0,
                    "user_playlists": 0,
                    "hashtag_videos": 0,
                    "sound_videos": 0,
                    "video_comments": 0,
                    "video_related": 0,
                },
                "keys": {
                    "user_info": [],
                    "hashtag_info": [],
                    "sound_info": [],
                    "video_info": [],
                },
                "data": results,
            }
            print(json.dumps(output, ensure_ascii=False, indent=2))
            return

        if args.trending > 0:
            sys.stderr.write(f"Fetching trending videos: {args.trending}\n")
            async for video in api.trending.videos(count=args.trending):
                results["trending"].append(video.as_dict)

        if args.search:
            try:
                sys.stderr.write(f"Searching users for: {args.search}\n")
                async for user in api.search.users(args.search, count=args.search_count):
                    results["search_users"].append(user.as_dict)
            except Exception as exc:  # noqa: BLE001
                results["search_error"] = str(exc)
                results["search_trace"] = traceback.format_exc()

        if args.username:
            sys.stderr.write(f"Fetching user info: {args.username}\n")
            user = api.user(username=args.username)
            try:
                results["user"]["info"] = await user.info()
            except Exception as exc:  # noqa: BLE001
                results["user"]["info_error"] = str(exc)
                results["user"]["info_trace"] = traceback.format_exc()
                results["user"]["videos"] = []
                sys.stderr.write("User info failed; skipping video fetch.\n")
                user = None

            if user is not None:
                results["user"]["videos"] = []
                sys.stderr.write(f"Fetching user videos: {args.user_videos}\n")
                async for video in user.videos(count=args.user_videos):
                    results["user"]["videos"].append(video.as_dict)

            if user is not None:
                try:
                    results["user"]["liked"] = []
                    sys.stderr.write(f"Fetching user liked videos: {args.user_likes}\n")
                    async for video in user.liked(count=args.user_likes):
                        results["user"]["liked"].append(video.as_dict)
                except Exception as exc:  # noqa: BLE001 - report API privacy errors
                    results["user"]["liked_error"] = str(exc)
                    results["user"]["liked_trace"] = traceback.format_exc()

            if user is not None:
                try:
                    results["user"]["playlists"] = []
                    sys.stderr.write(f"Fetching user playlists: {args.user_playlists}\n")
                    async for playlist in user.playlists(count=args.user_playlists):
                        results["user"]["playlists"].append(playlist.as_dict)
                except Exception as exc:  # noqa: BLE001 - report API errors
                    results["user"]["playlists_error"] = str(exc)
                    results["user"]["playlists_trace"] = traceback.format_exc()

            if args.hashtag:
                sys.stderr.write(f"Fetching hashtag info: {args.hashtag}\n")
                hashtag = api.hashtag(name=args.hashtag)
                results["hashtag"]["info"] = await hashtag.info()
                results["hashtag"]["videos"] = []
                async for video in hashtag.videos(count=args.hashtag_videos):
                    results["hashtag"]["videos"].append(video.as_dict)

            if args.sound_id:
                sys.stderr.write(f"Fetching sound info: {args.sound_id}\n")
                sound = api.sound(id=args.sound_id)
                results["sound"]["info"] = await sound.info()
                results["sound"]["videos"] = []
                async for video in sound.videos(count=args.sound_videos):
                    results["sound"]["videos"].append(video.as_dict)

            if args.video_id or args.video_url:
                sys.stderr.write("Fetching video info...\n")
                video = api.video(id=args.video_id, url=args.video_url)
                results["video"]["info"] = await video.info()

                results["video"]["comments"] = []
                sys.stderr.write(f"Fetching video comments: {args.video_comments}\n")
                async for comment in video.comments(count=args.video_comments):
                    results["video"]["comments"].append(comment.as_dict)

                results["video"]["related"] = []
                sys.stderr.write(f"Fetching related videos: {args.video_related}\n")
                async for related in video.related_videos(count=args.video_related):
                    results["video"]["related"].append(related.as_dict)

                if args.video_bytes:
                    sys.stderr.write("Fetching video bytes...\n")
                    results["video"]["bytes"] = await video.bytes()

    sys.stderr.write("TikTok scrape complete.\n")

    output = {
        "counts": {
            "trending": len(results["trending"]),
            "search_users": len(results["search_users"]),
            "user_videos": len(results["user"].get("videos", [])),
            "user_liked": len(results["user"].get("liked", [])),
            "user_playlists": len(results["user"].get("playlists", [])),
            "hashtag_videos": len(results["hashtag"].get("videos", [])),
            "sound_videos": len(results["sound"].get("videos", [])),
            "video_comments": len(results["video"].get("comments", [])),
            "video_related": len(results["video"].get("related", [])),
        },
        "keys": {
            "user_info": sorted((results["user"].get("info") or {}).keys()),
            "hashtag_info": sorted((results["hashtag"].get("info") or {}).keys()),
            "sound_info": sorted((results["sound"].get("info") or {}).keys()),
            "video_info": sorted((results["video"].get("info") or {}).keys()),
        },
        "data": results,
    }

    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            json.dump(output, handle, ensure_ascii=False, indent=2)
        print(f"Wrote output to {args.output}")
    else:
        print(json.dumps(output, ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch TikTok data via TikTokApi")
    parser.add_argument("--trending", type=int, default=5)

    parser.add_argument("--search", nargs="?", const="", default="")
    parser.add_argument("--search-count", type=int, default=5)

    parser.add_argument("--username", type=str, default="")
    parser.add_argument("--profile-url", type=str, default="")
    parser.add_argument("--user-videos", type=int, default=5)
    parser.add_argument("--user-likes", type=int, default=3)
    parser.add_argument("--user-playlists", type=int, default=3)

    parser.add_argument("--hashtag", type=str, default="")
    parser.add_argument("--hashtag-videos", type=int, default=5)

    parser.add_argument("--sound-id", type=str, default="")
    parser.add_argument("--sound-videos", type=int, default=5)

    parser.add_argument("--video-id", type=str, default="")
    parser.add_argument("--video-url", type=str, default="")
    parser.add_argument("--video-comments", type=int, default=5)
    parser.add_argument("--video-related", type=int, default=5)
    parser.add_argument("--video-bytes", action="store_true")

    parser.add_argument("--output", type=str, default="")
    return parser


if __name__ == "__main__":
    asyncio.run(run(build_parser().parse_args()))
