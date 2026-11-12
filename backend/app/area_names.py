from difflib import get_close_matches

KNOWN_AREAS = [
    "Ariyalai", "Atchuvely", "Chavakacheri", "Chunnakam", "Jaffna Town",
    "Karainagar", "Kayts", "Kondavil", "Kopay", "Manipay", "Nallur",
    "Nelliady", "Point Pedro", "Tellippalai", "Uduvil", "Valvettithurai",
]

# Other spellings that OSM or users may give
ALIASES = {
    "jaffna": "Jaffna Town",
    "yalpanam": "Jaffna Town",
    "achchuveli": "Atchuvely",
    "achuveli": "Atchuvely",
    "chavakachcheri": "Chavakacheri",
    "chankanai": "Chunnakam",
    "kaytes": "Kayts",
    "kayts island": "Kayts",
    "kopai": "Kopay",
    "thellippalai": "Tellippalai",
    "tellipalai": "Tellippalai",
    "nelliyadi": "Nelliady",
    "pointpedro": "Point Pedro",
    "peruthurai": "Point Pedro",
    "vvt": "Valvettithurai",
    "valvettiturai": "Valvettithurai",
}

_LOWER = {a.lower(): a for a in KNOWN_AREAS}


def resolve_area_name(candidates, default="Jaffna Town"):
    """candidates = list of place names, best first.
    Returns (area_name, matched: bool)."""
    for raw in candidates:
        if not raw:
            continue
        key = str(raw).strip().lower()
        if key in _LOWER:
            return _LOWER[key], True
        if key in ALIASES:
            return ALIASES[key], True
        close = get_close_matches(key, list(_LOWER) + list(ALIASES), n=1, cutoff=0.8)
        if close:
            c = close[0]
            return _LOWER.get(c) or ALIASES[c], True
    return default, False