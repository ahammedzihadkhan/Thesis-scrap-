"""Bangla training data for the KroyPulse offline message writer (the Bangla twin of make_data.py).

The customers are drawn exactly as for the English writer (same facts, same suggestion rules, same held-out names,
shops and products), but every message is written by a Bangla phrase grammar. The grammar follows the same persuasion
principles and the same rule: a message only makes claims the facts support, and every name, product, number, price
and code is copied from the facts. Facts that are words in English (last order, usual gap, offer) are given to the
model already in Bangla ("2 সপ্তাহ আগে", "প্রতি 3 সপ্তাহে", "15% ছাড়"), so it copies them instead of translating
them. Numbers, prices (Tk 1,360) and codes stay in Latin digits and letters, as shops write them on WhatsApp.
src/ai/messageFacts.ts (factsToInput with lang 'bn') and src/ai/aiWording.ts (checkMessage with lang 'bn')
apply the same rules: change them together.

Run:  scripts/writer/.venv/Scripts/python scripts/writer/make_data_bn.py
Out:  scripts/writer/out/data_bn/{train,val,test_synth,test_uci}.jsonl, one {"input", "target", "facts"} per line
      (facts are the English-valued facts, so the app and the evaluation script can rebuild the input).
"""
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_data as M  # noqa: E402  (customers, suggestions, prices and the English fact string)

OUT = Path(__file__).resolve().parent / "out" / "data_bn"

# ---------------------------------------------------------------- facts in Bangla (the app builds the same strings)

def when_bn(s):
    """'2 weeks ago' -> '2 সপ্তাহ আগে'. The same rule is in src/ai/messageFacts.ts (bnWhen)."""
    if s == "-":
        return s
    if s == "over a year ago":
        return "এক বছরেরও বেশি আগে"
    m = re.fullmatch(r"(\d+) (day|days|weeks|months|years) ago", s)
    unit = {"day": "দিন", "days": "দিন", "weeks": "সপ্তাহ", "months": "মাস", "years": "বছর"}
    return f"{m.group(1)} {unit[m.group(2)]} আগে"


def gap_bn(s):
    """'every 3 weeks' -> 'প্রতি 3 সপ্তাহে'."""
    fixed = {"-": "-", "every day": "প্রতিদিন", "every week": "প্রতি সপ্তাহে", "every month": "প্রতি মাসে",
             "about once a year": "বছরে প্রায় একবার"}
    if s in fixed:
        return fixed[s]
    m = re.fullmatch(r"every (\d+) (days|weeks|months)", s)
    unit = {"days": "দিনে", "weeks": "সপ্তাহে", "months": "মাসে"}
    return f"প্রতি {m.group(1)} {unit[m.group(2)]}"


def offer_bn(s):
    """'15% off' -> '15% ছাড়'."""
    fixed = {"-": "-", "free delivery": "ফ্রি ডেলিভারি", "a free gift": "ফ্রি উপহার", "a special discount": "বিশেষ ছাড়"}
    if s in fixed:
        return fixed[s]
    m = re.fullmatch(r"(\d+(?:\.\d+)?)% off", s)
    return f"{m.group(1)}% ছাড়"


def bn_facts(f):
    """The model's input facts: the English ones with the three word-facts in Bangla."""
    g = dict(f)
    g["last order"], g["usual gap"], g["offer"] = when_bn(f["last order"]), gap_bn(f["usual gap"]), offer_bn(f["offer"])
    return g


def to_input_bn(f):
    return M.to_input(bn_facts(f))


# ---------------------------------------------------------------- Bangla names, shops and products

NAMES_BN = dict(zip(M.BD_NAMES, """রহিম করিম নুসরাত ফারহানা তানভীর সাব্বির মিতু রুমানা আরিফ সুমাইয়া জান্নাত তাসনিম ইমরান রাকিব শুভ আনিকা সাদিয়া
মেহেদী রিয়া জয়া ফাহিম নাবিলা তাহমিদ ইশরাত শান্ত আয়েশা হাসান রাফি লামিয়া পূজা অনন্যা অর্ণব মাহি সাকিব তানিয়া ফারিয়া
বৃষ্টি শাকিল রনি মৌমিতা দীপা শারমিন কামরুল হাবিব জামাল রিমা শীলা তুষার আসিফ নাঈম রাসেল সোহেল লিজা পপি মিম রাতুল
নাফিসা সাজিদ তামান্না রিফাত ওরিন প্রমা নাদিয়া ফারদিন রূপা বাবুল সেলিনা মিজান শিরিন হৃদয় অন্তরা সৌরভ প্রিয়া মনির
নিপা পলাশ রুবেল সাথী কাওসার লিমা সুমন রুমা জুয়েল কেয়া মাসুদ ঋতু সোহাগ বন্যা আলামিন শাপলা রিদয় তিশা""".split()))
assert len(NAMES_BN) == len(M.BD_NAMES), (len(NAMES_BN), len(M.BD_NAMES))

SHOPS_BN = {
    "fashion": ["রংধনু ফ্যাশন", "শাপলা বুটিক", "নীলাচল ফ্যাশন", "বাংলার তাঁত", "ছোঁয়া কালেকশন", "রূপসী পোশাকঘর"],
    "beauty": ["কৃষ্ণচূড়া বিউটি", "মায়াবন কসমেটিকস", "রূপসী বিউটি বক্স", "নিখাদ স্কিনকেয়ার", "ঝিলমিল গ্লো"],
    "grocery": ["পদ্মা ফ্রেশ মার্ট", "সোনালী বাজার", "গ্রামের খাঁটি", "সেরা সুপার শপ", "মায়ের হাতের স্বাদ"],
    "gadgets": ["ঢাকা গ্যাজেট হাব", "টেক বাজার", "মোবাইল ঘর", "স্মার্ট জোন", "ডিজিটাল দুনিয়া"],
    "home": ["মেঘলা হোম ডেকর", "গৃহসজ্জা", "নকশী ঘর", "আপন নীড়", "ঘরোয়া স্টোর"],
    "kids": ["খুশি কিডস ওয়ার্ল্ড", "ছোট্ট পরী", "সোনামণি শপ", "টুনটুনি কিডস", "দুষ্টুমিষ্টি"],
    "gifts": ["আনন্দ গিফট শপ", "উপহার ঘর", "মনের মতো গিফট", "হাসিখুশি গিফট কর্নার"],
}

PRODUCTS_BN = {
    "fashion": """জামদানি শাড়ি|তাঁতের শাড়ি|সুতি থ্রি-পিস|ছেলেদের পাঞ্জাবি|হিজাব|সিল্ক ওড়না|লং কুর্তি|লুঙ্গি|গামছা|নকশি কাঁথা স্টোল|
চামড়ার স্যান্ডেল|শাল|কটন ফতুয়া|সিল্ক পাঞ্জাবি|মেয়েদের হ্যান্ডব্যাগ|চুড়ির সেট|জয়পুরি কুর্তি|স্লিপার""",
    "beauty": """অ্যালোভেরা ফেস ওয়াশ|হারবাল হেয়ার অয়েল|মেহেদি কোন|রোজ ওয়াটার|ম্যাট লিপস্টিক|কাজল|সানস্ক্রিন|নিম সাবান|নারকেল তেল|
বডি লোশন|আতর|নাইট ক্রিম|হ্যান্ড ক্রিম|লিপ বাম|অ্যান্টি-ড্যান্ড্রাফ শ্যাম্পু|ফেস প্যাক""",
    "grocery": """সুন্দরবনের খাঁটি মধু|সরিষার তেল|চিনিগুঁড়া চাল|আজওয়া খেজুর|খাঁটি ঘি|কালোজিরা তেল|হলুদ গুঁড়া|মরিচ গুঁড়া|আমের আচার|
মুড়ি|লইট্টা শুঁটকি|চা পাতা|কাজুবাদাম|খেজুরের গুড়|মসুর ডাল|আখের গুড়""",
    "gadgets": """ওয়্যারলেস ইয়ারবাড|পাওয়ার ব্যাংক|ফাস্ট চার্জার|ফোন কভার|স্মার্ট ওয়াচ|ব্লুটুথ স্পিকার|টাইপ-সি ক্যাবল|রিং লাইট|ল্যাপটপ স্ট্যান্ড|
গেমিং মাউস|মিনি ফ্যান|স্মার্ট বাল্ব|ওয়াই-ফাই রাউটার|মেমোরি কার্ড|ট্রিমার|কিবোর্ড""",
    "home": """নন-স্টিক ফ্রাই প্যান|রাইস কুকার|নকশি কাঁথা কুশন কভার|বিছানার চাদর|মাটির চায়ের সেট|দেয়াল ঘড়ি|জায়নামাজ|বাঁশের ঝুড়ি|ডিনার সেট|
ব্লেন্ডার|পাটের পাপোশ|কাচের পানির জগ|প্রেসার কুকার|সুগন্ধি মোমবাতি|মাটির ফুলদানি""",
    "kids": """বাচ্চাদের ফ্রক|বেবি রম্পার|স্কুল ব্যাগ|গল্পের বইয়ের সেট|বিল্ডিং ব্লক|খেলনা গাড়ি|ধাঁধা সেট|ফিডিং বোতল|ছবি আঁকার খাতা|
টেডি বিয়ার|লাঞ্চ বক্স|রঙ পেন্সিলের বাক্স""",
}

# ---------------------------------------------------------------- phrase grammar
# Slots: {N} name, {S} shop, {B1} top product, {BL} top two products, {O} orders, {L} last order ("2 সপ্তাহ আগে"),
# {LD} the same as a duration ("2 সপ্তাহ"), {G} usual gap ("প্রতি 3 সপ্তাহে"), {P} suggested product, {PR} its price
# (after a percentage offer), {W} its old price, {OF} offer ("15% ছাড়"), {C} code, {BC} the bought product the suggestion
# comes from, {TB} what the product type does for the customer ("আপনার লুক সম্পূর্ণ করতে"). Products are put in quotation
# marks so a Latin name stays readable inside a Bangla sentence. A line is used only when all of its facts exist.
# The words "বেস্ট সেলার", "যারা ... কিনেছেন" (what other customers bought), a first or second order, deadlines and
# negations follow the rules of aiWording.ts: they appear only where the facts support them.

TYPE_BENEFIT = {
    "electronics": ["সেটআপ সম্পূর্ণ করতে", "গ্যাজেট থেকে আরও বেশি সুবিধা পেতে", "সেটআপ আরও ভালো করতে"],
    "fashion": ["লুক সম্পূর্ণ করতে", "পোশাকের সংগ্রহ নতুন করতে", "সাজ পূর্ণ করতে"],
    "beauty": ["রুটিন সম্পূর্ণ করতে", "ত্বকের যত্ন নিতে", "নিজেকে একটু আদর করতে"],
    "grocery": ["রান্নাঘর ভরে রাখতে", "ঘরের দরকারি জিনিস হাতের কাছে রাখতে", "খাবারে নতুন স্বাদ আনতে"],
    "home": ["ঘরকে আরও আরামদায়ক করতে", "ঘর আরও সুন্দর করে সাজাতে", "ঘরে নতুন ছোঁয়া আনতে"],
    "kids": ["ছোট্ট সোনামণিকে খুশি করতে", "ছোট্ট সোনামণির মুখে হাসি ফোটাতে"],
    "gifts": ["প্রিয়জনকে উপহার দিতে", "কারও মুখে হাসি ফোটাতে", "কাছের মানুষকে খুশি করতে"],
}

OPEN = {
    "friendly": ["প্রিয় {N}!", "হ্যালো {N}!", "হাই {N}!", "প্রিয় {N},", "হ্যালো {N},", "হ্যালো!", "প্রিয় গ্রাহক,", "{S} থেকে শুভেচ্ছা!"],
    "formal": ["প্রিয় {N},", "সম্মানিত {N},", "সম্মানিত গ্রাহক,", "প্রিয় গ্রাহক,", "{S}-এর পক্ষ থেকে আন্তরিক শুভেচ্ছা।"],
}

HOOK = {  # one or two per message: the psychological opener of each customer group
    "best": {  # recognition, belonging, reciprocity
        "friendly": ["আপনি আমাদের সেরা গ্রাহকদের একজন, আর আমরা সত্যিই কৃতজ্ঞ!",
                     "{O}টি অর্ডার পেরিয়েও আপনি আমাদের পাশে - সত্যিই আপনি {S} পরিবারের অংশ!",
                     "{O}টি অর্ডারের জন্য ধন্যবাদ - আপনার মতো গ্রাহকরাই {S}-এর প্রাণ।",
                     "আপনি {B1} কত পছন্দ করেন তা আমরা লক্ষ্য করেছি, তাই আপনার কথা মনে রেখেছি।",
                     "আপনি {G} আমাদের কাছ থেকে কেনাকাটা করেন, এটা আমাদের কাছে অনেক বড় পাওয়া।",
                     "আপনি {BL} পছন্দ করেন বলেই আপনার জন্য বিশেষ কিছু বেছেছি।",
                     "আপনার অর্ডার প্যাক করতে আমাদের সবসময় ভালো লাগে, বিশেষ করে আপনার {B1}!",
                     "{B1} নিয়ে আপনার রুচি দারুণ, তাই আপনার জন্য বিশেষ কিছু বেছেছি।"],
        "formal": ["{S}-এর অন্যতম সম্মানিত গ্রাহক হিসেবে আপনাকে আন্তরিক ধন্যবাদ।",
                   "{S}-এ আপনার {O}টি অর্ডারের জন্য আমরা আন্তরিকভাবে কৃতজ্ঞ।",
                   "আপনার আস্থা আমাদের সবার কাছে অত্যন্ত মূল্যবান।",
                   "{BL} নিয়ে আপনার আগ্রহ আমরা লক্ষ্য করেছি, তাই আপনার জন্য বিশেষ কিছু বেছে নিয়েছি।",
                   "আপনি {G} আমাদের সঙ্গে কেনাকাটা করেন, সেজন্য ব্যক্তিগতভাবে ধন্যবাদ জানাতে চাই।"],
    },
    "regular": {  # consistency with their habit, liking
        "friendly": ["আপনি সাধারণত {G} অর্ডার করেন, তাই সবার আগে আপনার কথাই মনে পড়ল!",
                     "আপনার শেষ অর্ডারের পর {LD} হয়ে গেছে - নতুন কিছু দেখার এখনই ঠিক সময়!",
                     "নিয়মিত কেনাকাটার জন্য ধন্যবাদ - {O}টি অর্ডার হয়ে গেল!",
                     "আপনাকে আবার {B1} নিতে দেখলে আমরা খুব খুশি হই!",
                     "আপনি {BL} ভালোবাসেন, তাই আপনার জন্য বিশেষ কিছু বেছেছি।",
                     "ভালো জিনিস চিনতে আপনি ওস্তাদ - আপনার {B1} তারই প্রমাণ!",
                     "আপনার শেষ অর্ডার ছিল {L}, তখন থেকেই আপনার জন্য একটা কিছু তুলে রেখেছি।",
                     "আপনার {B1}-এর অর্ডারগুলো আমাদের মুখে হাসি ফোটায়!"],
        "formal": ["আপনি সাধারণত {G} আমাদের সঙ্গে কেনাকাটা করেন, তাই আপনার জন্য একটি পরামর্শ দিচ্ছি।",
                   "{S}-এ আপনার {O}টি অর্ডারের জন্য ধন্যবাদ।",
                   "আশা করি আপনি আপনার {B1} উপভোগ করছেন।",
                   "আপনার শেষ অর্ডার ছিল {L}, তাই আপনার জন্য নতুন কিছু বেছে নিয়েছি।",
                   "{S}-এ আপনার নিয়মিত অর্ডারকে আমরা সত্যিই মূল্যবান মনে করি।"],
    },
    "slipping": {  # being missed, empathy, a reward already saved (loss aversion)
        "friendly": ["আপনার শেষ অর্ডারের পর {LD} হয়ে গেছে, আমরা আপনাকে খুব মিস করছি!",
                     "{S}-এ আমরা আপনাকে মিস করছি! আপনার শেষ অর্ডার ছিল {L}।",
                     "আশা করি আপনার {B1} আপনার ভালো লাগছে! অনেকদিন হয়ে গেল।",
                     "আপনি আগে {G} অর্ডার করতেন, আর আমরা আপনাকে সত্যিই মিস করছি!",
                     "জীবন ব্যস্ত, আমরা বুঝি! তাই ফিরে আসাটা সহজ করে দিয়েছি।",
                     "আপনার শেষ অর্ডার ছিল {L}, তাই আপনার জন্য বিশেষ কিছু তুলে রেখেছি।",
                     "আপনি আগে {B1} বেছে নিয়েছিলেন, তাই আপনার জন্য নতুন কিছু বেছেছি।"],
        "formal": ["{S}-এ আমরা আপনাকে মিস করছি; আপনার শেষ অর্ডার ছিল {L}।",
                   "আশা করি আপনি আপনার {B1} উপভোগ করছেন।",
                   "আপনার শেষ অর্ডারের পর {LD} হয়ে গেছে, আপনাকে আবার স্বাগত জানাতে পারলে আমরা আনন্দিত হব।",
                   "আপনাকে আমরা মূল্যবান গ্রাহক মনে করি এবং {S}-এ আবার দেখতে চাই।"],
    },
    "inactive": {  # warm welcome back, low effort fresh start
        "friendly": ["আপনার শেষ অর্ডারের পর অনেকদিন হয়ে গেছে ({L}), আপনাকে আবার পেলে আমরা খুশি হব!",
                     "আপনাকে {S}-এ আবার স্বাগত জানাতে চাই!",
                     "আপনার {B1}-এর কথা মনে আছে? আপনাকে আবার দেখতে চাই!",
                     "নতুন করে শুরু করা মাত্র একটি রিপ্লাই দূরে।",
                     "{LD} হয়ে গেল - আপনাকে আমরা মিস করেছি!",
                     "আপনার শেষ অর্ডার ছিল {L}, তারপর থেকেই আপনার কথা ভাবছি!",
                     "আপনাকে {S}-এ আবার দেখতে চাই!"],
        "formal": ["{S}-এ আপনার শেষ অর্ডারের পর কিছুটা সময় পেরিয়ে গেছে ({L})।",
                   "{S}-এ আপনাকে আবার স্বাগত জানাতে পারলে আমরা আনন্দিত হব।",
                   "আশা করি আপনি আপনার {B1} উপভোগ করেছেন, এবং আপনাকে আবার সেবা দিতে পারলে আমরা খুশি হব।"],
    },
    "promising": {  # progress and encouragement
        "friendly": ["ইতোমধ্যেই {O}টি অর্ডার - আপনি আমাদের প্রিয় গ্রাহকদের একজন হয়ে উঠছেন!",
                     "আবার {S}-এ আসার জন্য ধন্যবাদ - এটা আমাদের কাছে অনেক বড় ব্যাপার!",
                     "আবার {B1} বেছে নেওয়ার জন্য আমরা খুবই খুশি!",
                     "{S}-এর সাথে আপনার শুরুটা দারুণ হয়েছে!",
                     "আপনার {B1} ছিল দারুণ একটি পছন্দ, আর আপনার জন্য আরেকটি বেছে রেখেছি!"],
        "formal": ["{S}-এ আবার আসার জন্য আপনাকে ধন্যবাদ।",
                   "আপনি ইতোমধ্যে আমাদের কাছ থেকে {O}টি অর্ডার করেছেন, এতে আমরা আনন্দিত।",
                   "আশা করি আপনার {B1} ভালো লেগেছে এবং আপনি আবার আমাদের বেছে নিয়েছেন।"],
    },
    "new": {  # welcome and reassurance
        "friendly": ["{S} পরিবারে স্বাগতম, প্রথম অর্ডারের জন্য ধন্যবাদ!",
                     "আশা করি আপনার {B1} নিরাপদে পৌঁছেছে আর আপনার ভালো লাগছে!",
                     "{S}-কে বেছে নেওয়ার জন্য ধন্যবাদ - আপনাকে পেয়ে আমরা খুব খুশি!",
                     "আপনার প্রথম অর্ডার প্যাক করতে পেরে আমাদের খুব ভালো লেগেছে!",
                     "প্রথম অর্ডারে আপনি {B1} বেছে নিয়েছেন, এতে আমরা আনন্দিত!"],
        "formal": ["{S}-এ স্বাগতম, আপনার প্রথম অর্ডারের জন্য ধন্যবাদ।",
                   "আশা করি আপনার {B1} আপনার প্রত্যাশা পূরণ করেছে।",
                   "প্রথম কেনাকাটার জন্য {S}-কে বেছে নেওয়ায় আপনাকে ধন্যবাদ।"],
    },
    "once": {  # re-engagement through their first purchase
        "friendly": ["আপনার {B1} কেমন লাগছে? আমরা জানতে চাই!",
                     "আপনার অর্ডারের পর {LD} হয়ে গেছে, আপনাকে আবার দেখতে চাই!",
                     "আপনার {B1} প্যাক করার কথা আমাদের এখনও মনে আছে!",
                     "আপনার প্রথম অর্ডার ছিল {L} - এবার দ্বিতীয়বারের জন্য তৈরি?",
                     "আপনার {B1} ছিল দারুণ একটি পছন্দ!"],
        "formal": ["আশা করি আপনি আপনার {B1} নিয়ে সন্তুষ্ট।",
                   "আপনার {L} করা অর্ডারের জন্য আবারও ধন্যবাদ।",
                   "{S}-এ আপনাকে আবার সেবা দিতে পারলে আমরা আনন্দিত হব।"],
    },
}

# The suggestion, by why it was chosen. Only "together" lines say what other customers bought.
PITCH = {
    "together": {
        "friendly": ["যারা {BC} কিনেছেন, তারা {P}-ও কিনেছেন।", "{BC} কেনা গ্রাহকরা প্রায়ই {P}-ও নেন।",
                     "{P} প্রায়ই {BC}-এর সঙ্গে একসাথে কেনা হয়।", "যারা {BC} কিনেছেন, তারা {TB} {P}-ও নিয়েছেন।",
                     "অন্য ক্রেতাদের একটি টিপস: {BC} যাঁরা কিনেছেন, তাঁরা {P}-ও বেছে নিয়েছেন।"],
        "formal": ["যে গ্রাহকরা {BC} ক্রয় করেছেন, তাঁরা {P}-ও ক্রয় করেছেন।", "{BC} ক্রয়কারী গ্রাহকরা প্রায়ই {P} বেছে নেন।",
                   "যাঁরা {BC} কিনেছেন, তাঁরা প্রায়ই {TB} {P} বেছে নেন।"],
    },
    "similar": {
        "friendly": ["আপনার {BC} ভালো লেগে থাকলে {P}-ও আপনার পছন্দ হবে।",
                     "আপনি {BC} পছন্দ করেছেন, তাই মনে হয় {P}-ও আপনার ভালো লাগবে।",
                     "{BC} ভালোবাসেন? তাহলে {P} দেখে নিন।", "{TB} {P} হতে পারে দারুণ একটি পছন্দ।",
                     "আপনার রুচি দারুণ - {BC}-এর পর {P}-ই হতে পারে সেরা পছন্দ।"],
        "formal": ["{BC}-এর প্রতি আপনার আগ্রহ বিবেচনা করে আমরা {P} সুপারিশ করছি।",
                   "আপনি {BC} পছন্দ করেছেন, তাই {P}-ও আপনার ভালো লাগতে পারে।",
                   "{BC}-এর প্রতি আপনার আগ্রহ দেখে আমরা মনে করি {P} আপনার জন্য উপযুক্ত।"],
    },
    "best": {
        "friendly": ["{P} আমাদের একটি বেস্ট সেলার।", "{P} আমাদের সবচেয়ে জনপ্রিয় পছন্দগুলোর একটি।",
                     "অনেক গ্রাহকই {P} বেছে নিয়েছেন।", "{TB} আমাদের বেস্ট সেলার {P} দারুণ একটি উপায়।"],
        "formal": ["{P} আমাদের সর্বাধিক বিক্রিত পণ্যগুলোর একটি।", "আমরা {P} সুপারিশ করছি, যা আমাদের সবচেয়ে জনপ্রিয় পণ্যগুলোর একটি।",
                   "আমাদের অনেক গ্রাহক {TB} {P} বেছে নেন।"],
    },
    "new": {
        "friendly": ["একটু নতুন কিছু চান? {P} দেখে নিন।", "এবার আপনার জন্য নতুন কিছু: {P}।",
                     "নতুন কিছু ট্রাই করার সময় এসেছে: {P}।", "নতুন কিছু খুঁজে দেখতে চান? {P} হতে পারে আপনার পরবর্তী প্রিয়।",
                     "নিজেকে একটু আলাদা কিছু উপহার দিন: {P}।"],
        "formal": ["আমরা আপনাকে নতুন কিছুর সঙ্গে পরিচয় করিয়ে দিতে চাই: {P}।", "{P} আপনার ভালো লাগতে পারে।",
                   "একটু ভিন্নতার জন্য আমরা {P} সুপারিশ করছি।"],
    },
    "none": {
        "friendly": ["আপনার জন্য বিশেষভাবে {P} বেছেছি।", "{P} একবার দেখে নিন।", "{P} আপনার ভালো লাগতে পারে।",
                     "{TB} {P} হতে পারে দারুণ একটি পছন্দ।"],
        "formal": ["আপনার জন্য আমরা {P} বেছে নিয়েছি।", "{P} আপনার আগ্রহের হতে পারে।", "{TB} আমরা {P} সুপারিশ করছি।"],
    },
}
PITCH_PRICE = {  # the same with the regular price (no percentage offer)
    "together": {
        "friendly": ["যারা {BC} কিনেছেন, তারা {P}-ও কিনেছেন - আর এটি মাত্র {PR}।", "{BC} কেনা গ্রাহকরা প্রায়ই {P}-ও নেন, মাত্র {PR}।",
                     "{P} প্রায়ই {BC}-এর সঙ্গে একসাথে কেনা হয়, আর দাম মাত্র {PR}।",
                     "যারা {BC} কিনেছেন, তারা {TB} {P}-ও নিয়েছেন - মাত্র {PR}।"],
        "formal": ["যে গ্রাহকরা {BC} ক্রয় করেছেন, তাঁরা {P}-ও ক্রয় করেছেন; এর মূল্য {PR}।",
                   "{BC} ক্রয়কারী গ্রাহকরা প্রায়ই {P} বেছে নেন, যার মূল্য {PR}।"],
    },
    "similar": {
        "friendly": ["আপনার {BC} ভালো লেগে থাকলে {P}-ও আপনার পছন্দ হবে - মাত্র {PR}।",
                     "আপনি {BC} পছন্দ করেছেন, তাই {P}-ও ভালো লাগবে, দাম মাত্র {PR}।", "{BC}-এর পর {P}-ই হতে পারে আপনার সেরা পছন্দ, মাত্র {PR}।"],
        "formal": ["{BC}-এর প্রতি আপনার আগ্রহ বিবেচনা করে আমরা {P} সুপারিশ করছি, মূল্য {PR}।",
                   "আপনি {BC} পছন্দ করেছেন, তাই {P}-ও আপনার ভালো লাগতে পারে; মূল্য {PR}।"],
    },
    "best": {
        "friendly": ["{P} আমাদের একটি বেস্ট সেলার, আর দাম মাত্র {PR}।", "{P} আমাদের সবচেয়ে জনপ্রিয় পছন্দগুলোর একটি - মাত্র {PR}।",
                     "অনেক গ্রাহকই {P} বেছে নিয়েছেন, দাম মাত্র {PR}।"],
        "formal": ["{P} আমাদের সর্বাধিক বিক্রিত পণ্যগুলোর একটি, মূল্য {PR}।",
                   "আমরা {P} সুপারিশ করছি, আমাদের অন্যতম জনপ্রিয় পণ্য, মূল্য {PR}।"],
    },
    "new": {
        "friendly": ["একটু নতুন কিছু চান? {P} দেখে নিন - মাত্র {PR}।", "এবার আপনার জন্য নতুন কিছু: {P}, মাত্র {PR}।",
                     "{P} হতে পারে আপনার পরবর্তী প্রিয়, মাত্র {PR}।"],
        "formal": ["আমরা আপনাকে নতুন কিছুর সঙ্গে পরিচয় করিয়ে দিতে চাই: {P}, মূল্য {PR}।", "{P} আপনার ভালো লাগতে পারে; মূল্য {PR}।"],
    },
    "none": {
        "friendly": ["আপনার জন্য বিশেষভাবে {P} বেছেছি - মাত্র {PR}।", "{P} একবার দেখে নিন, মাত্র {PR}।", "{P} আপনার ভালো লাগতে পারে, দাম মাত্র {PR}।"],
        "formal": ["আপনার জন্য আমরা {P} বেছে নিয়েছি, মূল্য {PR}।", "{P} আপনার আগ্রহের হতে পারে; মূল্য {PR}।"],
    },
}

OFFER = {  # offer with a code, framed for the group
    "best": {"friendly": ["ধন্যবাদ হিসেবে আপনার ভিআইপি কোড {C} ব্যবহার করে {OF} পান।", "আপনার ভিআইপি উপহার: কোড {C} দিয়ে {OF} পান।",
                          "শুধু আমাদের ভিআইপিদের জন্য: কোড {C} দিয়ে {OF}।", "আপনার ভিআইপি কোড {C} ব্যবহার করুন, {OF} পাবেন।"],
             "formal": ["কৃতজ্ঞতার নিদর্শন হিসেবে আপনার কোড {C} দিয়ে {OF} পাবেন।",
                        "আপনার আস্থার প্রতি কৃতজ্ঞতা জানিয়ে অনুগ্রহ করে কোড {C} ব্যবহার করে {OF} গ্রহণ করুন।"]},
    "regular": {"friendly": ["আপনার নিয়মিত কেনাকাটার পুরস্কার: কোড {C} দিয়ে {OF}।", "কোড {C} ব্যবহার করুন, {OF} পাবেন।",
                             "পরের অর্ডারে কোড {C} দিয়ে {OF} পান।", "আপনি নিয়মিত গ্রাহক, তাই কোড {C} দিলেই {OF} পাবেন।"],
                "formal": ["নিয়মিত অর্ডারের জন্য ধন্যবাদ জানাতে অনুগ্রহ করে কোড {C} ব্যবহার করে {OF} গ্রহণ করুন।",
                           "অনুগ্রহ করে কোড {C} ব্যবহার করে {OF} গ্রহণ করুন।"]},
    "slipping": {"friendly": ["আপনার জন্য {OF} তুলে রেখেছি - শুধু কোড {C} ব্যবহার করুন।", "আবার স্বাগত জানাতে এই নিন {OF}, কোড {C}।",
                              "{OF} আপনার জন্য প্রস্তুত - শুধু কোড {C} ব্যবহার করুন।", "ফিরে আসুন, কোড {C} দিয়ে {OF} পান।"],
                 "formal": ["আপনাকে আবার স্বাগত জানাতে আমরা কোড {C} দিয়ে {OF} আলাদা করে রেখেছি।",
                            "ফিরে আসার জন্য অনুগ্রহ করে কোড {C} ব্যবহার করে {OF} গ্রহণ করুন।"]},
    "inactive": {"friendly": ["আবার স্বাগত জানাতে এই নিন {OF} - কোড {C} ব্যবহার করুন।", "ফিরে আসার পুরস্কার: কোড {C} দিয়ে {OF}।",
                              "কোড {C} ব্যবহার করে {OF} নিয়ে ফিরে আসুন।", "ফিরতি অর্ডারে কোড {C} দিলেই {OF} পাবেন।"],
                 "formal": ["আপনাকে আবার স্বাগত জানাতে অনুগ্রহ করে কোড {C} ব্যবহার করে {OF} গ্রহণ করুন।",
                            "ফিরে এলে আমরা কোড {C} দিয়ে {OF} দিতে চাই।"]},
    "promising": {"friendly": ["ধন্যবাদ জানাতে পরের অর্ডারে কোড {C} দিয়ে {OF} পান।", "এই ধারা বজায় রাখুন - কোড {C} দিয়ে {OF}।",
                               "পরের অর্ডারে কোড {C} ব্যবহার করে {OF} নিন।"],
                  "formal": ["ধন্যবাদ জানাতে অনুগ্রহ করে পরের অর্ডারে কোড {C} ব্যবহার করে {OF} গ্রহণ করুন।"]},
    "new": {"friendly": ["আপনার দ্বিতীয় অর্ডারে কোড {C} দিয়ে {OF} পাবেন।", "দ্বিতীয় অর্ডারে কোড {C} ব্যবহার করুন, {OF} পান।",
                         "স্বাগত উপহার: দ্বিতীয় অর্ডারে কোড {C} দিয়ে {OF}।"],
            "formal": ["অনুগ্রহ করে দ্বিতীয় অর্ডারে কোড {C} ব্যবহার করে {OF} গ্রহণ করুন।"]},
    "once": {"friendly": ["আপনার দ্বিতীয় অর্ডারে কোড {C} দিয়ে {OF} পাবেন।", "ফিরে আসুন, কোড {C} দিয়ে {OF} পান।",
                          "দ্বিতীয় অর্ডারে কোড {C} ব্যবহার করুন, {OF} পাবেন।"],
             "formal": ["অনুগ্রহ করে দ্বিতীয় অর্ডারে কোড {C} ব্যবহার করে {OF} গ্রহণ করুন।"]},
}
OFFER_NOCODE = {
    "friendly": ["আপনার পরের অর্ডারে {OF}!", "পরের অর্ডারে {OF} উপভোগ করুন!", "তাছাড়া, পরের অর্ডারে পাচ্ছেন {OF}।"],
    "formal": ["আপনার পরবর্তী অর্ডারে {OF} থাকবে।", "পরবর্তী অর্ডারে আপনি {OF} পাবেন।"],
}
# A percentage offer on the suggested product: the old price next to the new one (anchoring).
DEAL = {
    "friendly": ["কোড {C} ব্যবহার করলে {OF}: {W}-এর বদলে মাত্র {PR}।", "কোড {C} দিলে {OF} - {W}-এর বদলে মাত্র {PR}।",
                 "আপনার কোড {C} দিলে {OF}, তাই দাম পড়বে {W}-এর বদলে মাত্র {PR}।"],
    "formal": ["কোড {C} ব্যবহার করলে আপনি {OF} পাবেন: {W}-এর বদলে {PR}।",
               "কোড {C} প্রয়োগ করলে {OF} পাওয়া যাবে, ফলে মূল্য হবে {W}-এর বদলে {PR}।"],
}
DEAL_SEG = {
    ("best", "friendly"): ["ধন্যবাদ জানাতে আপনার ভিআইপি কোড {C} দিয়ে পাবেন {OF}: {W}-এর বদলে মাত্র {PR}।"],
    ("regular", "friendly"): ["আপনার নিয়মিত কেনাকাটার পুরস্কার: কোড {C} দিয়ে {OF}, {W}-এর বদলে মাত্র {PR}।"],
    ("slipping", "friendly"): ["আপনার জন্য {OF} তুলে রেখেছি, কোড {C} দিলেই {W}-এর বদলে মাত্র {PR}।"],
    ("inactive", "friendly"): ["ফিরে আসুন {OF} নিয়ে: কোড {C} দিলে {W}-এর বদলে মাত্র {PR}।"],
    ("promising", "friendly"): ["ধন্যবাদ হিসেবে কোড {C} দিয়ে {OF}: {W}-এর বদলে মাত্র {PR}।"],
    ("new", "friendly"): ["দ্বিতীয় অর্ডারে কোড {C} দিয়ে {OF}, ফলে {W}-এর বদলে মাত্র {PR}।"],
    ("once", "friendly"): ["দ্বিতীয় অর্ডারে কোড {C} দিয়ে {OF}, ফলে {W}-এর বদলে মাত্র {PR}।"],
    ("best", "formal"): ["কৃতজ্ঞতার নিদর্শন হিসেবে আপনার কোড {C} দিয়ে {OF}: {W}-এর বদলে {PR}।"],
}
DEAL_NOCODE = {"friendly": ["এতে আছে {OF}: {W}-এর বদলে মাত্র {PR}।"], "formal": ["এতে {OF} অন্তর্ভুক্ত: {W}-এর বদলে {PR}।"]}
DEAL_AFTER_OFFER = {"friendly": ["কোডটি দিলে দাম হবে {W}-এর বদলে মাত্র {PR}।", "তাতে দাম পড়বে {W}-এর বদলে মাত্র {PR}।"],
                    "formal": ["কোডটি প্রয়োগ করলে মূল্য হবে {W}-এর বদলে {PR}।"]}
CTA = {  # one small, easy step
    "friendly": ['রিপ্লাইতে শুধু "হ্যাঁ" লিখুন, আমরা সব প্রস্তুত করে রাখব।', "নিতে চান? শুধু রিপ্লাই করুন!",
                 "অর্ডার করতে এই মেসেজে রিপ্লাই করুন।", "রিপ্লাই করুন, বাকি সব আমরা সামলে নেব।",
                 'শুধু "হ্যাঁ" লিখে রিপ্লাই দিন, আপনার অর্ডার প্যাক করে ফেলব।', 'রিপ্লাইতে "হ্যাঁ" বললেই হবে!',
                 "শুধু একটা রিপ্লাই দিন, বাকিটা আমাদের কাজ।", 'আপনার জন্য প্যাক করে রাখি? শুধু "হ্যাঁ" লিখুন!'],
    "formal": ["অর্ডার করতে অনুগ্রহ করে এই বার্তায় উত্তর দিন।", 'অনুগ্রহ করে "হ্যাঁ" লিখে জানালে আমরা সব ব্যবস্থা করব।',
               "আপনার উত্তরের অপেক্ষায় রইলাম।", "অর্ডার করতে চাইলে অনুগ্রহ করে এই বার্তায় রিপ্লাই করুন।"],
}
SIGN = {
    "friendly": ["- {S} টিম", "শুভেচ্ছান্তে, {S}", "ভালোবাসায়, {S}", "ধন্যবাদ, {S} টিম", "শিগগির দেখা হবে! - {S}", "- {S}"],
    "formal": ["শুভেচ্ছান্তে, {S}", "ধন্যবাদান্তে, {S} টিম", "আন্তরিক শুভেচ্ছায়, {S}", "বিনীত, {S}"],
}

SHORT_OPEN = {
    "best": ["{N}, আপনি আমাদের ভিআইপি!", "{N}, আপনার জন্য ভিআইপি উপহার!", "ধন্যবাদ, {N}!", "ভিআইপিদের জন্য ধন্যবাদ!"],
    "regular": ["{N}, আপনার নিয়মিত অর্ডারের সময় হলো?", "হাই {N}! নিয়মিত থাকার জন্য ধন্যবাদ।", "আপনার নিয়মিত অর্ডারের সময় হলো?"],
    "slipping": ["{N}, আপনাকে মিস করছি!", "মিস করছি আপনাকে, {N}!", "আপনাকে মিস করছি!"],
    "inactive": ["{N}, {S}-এ ফিরে আসুন!", "অনেকদিন পর, {N}!", "{S}-এ ফিরে আসুন!"],
    "promising": ["আবার আসার জন্য ধন্যবাদ, {N}!", "আবার দেখে ভালো লাগল, {N}!", "আবার আসার জন্য ধন্যবাদ!"],
    "new": ["{S}-এ স্বাগতম, {N}!", "প্রথম অর্ডারের জন্য ধন্যবাদ, {N}!", "{S}-এ স্বাগতম!"],
    "once": ["{N}, দ্বিতীয়বারের জন্য তৈরি?", "হাই {N}, আপনাকে আবার দেখতে চাই!", "দ্বিতীয়বারের জন্য তৈরি?"],
}
SHORT_PITCH = {
    "together": ["{BC} যারা কিনেছেন, তারা {P}-ও নিয়েছেন।", "{BC} কিনেছেন? আপনার মতো ক্রেতারা {P}-ও নিয়েছেন।", "{BC} ক্রেতারা {P}-ও বেছে নেন।"],
    "similar": ["{BC} ভালো লেগেছে? {P} নিয়ে দেখুন।", "{BC} পছন্দ? {P}-ও ভালো লাগবে।", "আপনার {BC}-এর মতো আরও: {P}।"],
    "best": ["বেস্ট সেলার: {P}।", "আমাদের সবচেয়ে জনপ্রিয় পছন্দ: {P}।", "গ্রাহকদের প্রিয়: {P}।"],
    "new": ["নতুন কিছু: {P}।", "একটু অন্যরকম কিছু ট্রাই করুন: {P}।", "আপনার জন্য নতুন: {P}।"],
    "none": ["ট্রাই করুন {P}।", "আপনার জন্য বাছাই: {P}।"],
}
SHORT_PERSONAL = ["আপনার {B1} ভালো লেগেছে?", "{B1} কেমন লাগছে?", "আরও {B1} লাগবে?"]
SHORT_DEAL = ["কোড {C} দিয়ে {OF}: {PR} (আগে {W})।", "কোড {C} দিলে {PR} (আগে {W}) - মানে {OF}।", "{C} ব্যবহার করে {OF}: {W}-এর বদলে {PR}।"]
SHORT_DEAL_NOCODE = ["{OF}: {PR} (আগে {W})।"]
SHORT_PRICE = ["মাত্র {PR}।", "শুধু {PR}।"]
SHORT_OFFER = ["কোড {C} দিয়ে {OF}।", "{C} ব্যবহার করে {OF} পান।"]
SHORT_OFFER_NOCODE = ["পরের অর্ডারে {OF}!", "পরের অর্ডারে পাচ্ছেন {OF}!"]
SHORT_CTA = ["রিপ্লাই করুন!", "অর্ডার করতে রিপ্লাই দিন।", 'শুধু "হ্যাঁ" লিখুন।']
SHORT_CTA_NONE = ["যখন খুশি অর্ডার করতে রিপ্লাই করুন।", "যেকোনো সময় আমাদের মেসেজ করুন।"]
SHORT_SIGN = ["- {S}", "{S}", ""]

REASON_KEY = M.REASON_KEY
TIME_RE = re.compile(r"আগে|হয়ে গেছে|হয়ে গেল|মিস|শেষ অর্ডার|অনেকদিন")
quoted = lambda s: f'"{s}"'


def write_message_bn(f, rng):
    """One Bangla message for facts f, picked at random from the grammar (the structure of make_data.write_message)."""
    seg, tone = f["segment"], f["tone"]
    g = bn_facts(f)
    buys = [] if f["buys"] == "-" else f["buys"].split("; ")
    val = lambda k: None if g[k] == "-" else g[k]
    orders = int(f["orders"])
    last = val("last order")
    benefit = TYPE_BENEFIT.get(f["type"])
    ctx = {"N": val("name"), "S": f["shop"], "B1": quoted(buys[0]) if buys else None,
           "BL": " ও ".join(quoted(b) for b in buys[:2]) if buys else None, "O": str(orders) if orders >= 2 else None,
           "L": last, "LD": last[:-4] if last and last.endswith(" আগে") else None, "G": val("usual gap"),
           "P": quoted(f["suggest"]) if f["suggest"] != "-" else None, "PR": val("price"), "W": val("was"), "OF": val("offer"),
           "C": val("code"), "BC": quoted(f["because"]) if f["because"] != "-" else None,
           "TB": rng.choice(benefit) if benefit else None}
    key = REASON_KEY.get(f["reason"], "none")
    if key in ("together", "similar") and not ctx["BC"]:
        key = "none"
    names_bought = key in ("together", "similar")  # the pitch names a product they bought
    has_buy = lambda s: ctx["B1"] is not None and ctx["B1"] in s
    fill, usable, pick, pick_named = M.fill, M.usable, M.pick, M.pick_named

    if tone == "short":
        parts = [pick_named(SHORT_OPEN[seg], ctx, rng)]
        if buys and not names_bought and rng.random() < 0.8:
            parts.append(fill(rng.choice(SHORT_PERSONAL), ctx))
        if ctx["P"]:
            parts.append(pick(SHORT_PITCH[key], ctx, rng))
            if ctx["W"]:
                parts.append(pick(SHORT_DEAL if ctx["C"] else SHORT_DEAL_NOCODE, ctx, rng))
            else:
                parts.append(pick(SHORT_PRICE, ctx, rng))
                if ctx["OF"]:
                    parts.append(pick(SHORT_OFFER if ctx["C"] else SHORT_OFFER_NOCODE, ctx, rng))
        elif ctx["OF"]:
            parts.append(pick(SHORT_OFFER if ctx["C"] else SHORT_OFFER_NOCODE, ctx, rng))
        if not (ctx["P"] or ctx["OF"]):  # nothing to offer: an open invitation, signed
            parts += [rng.choice(SHORT_CTA_NONE), fill(rng.choice(SHORT_SIGN[:2]), ctx)]
            return " ".join(p for p in parts if p)
        if rng.random() < 0.5:
            parts.append(rng.choice(SHORT_CTA))
        if f["shop"] not in " ".join(p for p in parts if p) or rng.random() < 0.3:
            parts.append(fill(rng.choice(SHORT_SIGN), ctx))
        return " ".join(p for p in parts if p)

    greet = pick_named(OPEN[tone], ctx, rng)
    hooks = usable(HOOK[seg][tone], ctx)
    rng.shuffle(hooks)
    hook = hooks[: 2 if rng.random() < 0.2 else 1]
    if len(hook) == 2 and all(TIME_RE.search(h) for h in hook):
        hook = hook[:1]  # one mention of how long it has been is enough
    if buys and not names_bought and not any(has_buy(h) for h in hook):
        named = [h for h in hooks if has_buy(h)]
        if named:
            hook = [rng.choice(named)]  # always name something they bought
    lead_with_offer = seg in ("slipping", "inactive", "once", "new") and rng.random() < 0.35
    core = []
    if ctx["P"] and ctx["W"]:
        pitch = pick(PITCH[key][tone], ctx, rng)
        if ctx["C"] and lead_with_offer:
            core = [pick(OFFER[seg][tone], ctx, rng), pitch, pick(DEAL_AFTER_OFFER[tone], ctx, rng)]
        elif ctx["C"]:
            core = [pitch, pick(DEAL[tone] + DEAL_SEG.get((seg, tone), []), ctx, rng)]
        else:
            core = [pitch, pick(DEAL_NOCODE[tone], ctx, rng)]
    elif ctx["P"]:
        core = [pick(PITCH_PRICE[key][tone], ctx, rng)]
        if ctx["OF"]:
            offer = pick(OFFER[seg][tone] if ctx["C"] else OFFER_NOCODE[tone], ctx, rng)
            core.insert(0 if lead_with_offer else 1, offer)
    elif ctx["OF"]:
        core = [pick(OFFER[seg][tone] if ctx["C"] else OFFER_NOCODE[tone], ctx, rng)]
    parts = [greet] + hook + core
    if rng.random() < 0.6 or not core:
        parts.append(rng.choice(CTA[tone]))
    if rng.random() < 0.85:
        parts.append(fill(rng.choice(SIGN[tone]), ctx))
    return " ".join(p for p in parts if p)


# ---------------------------------------------------------------- the app's Bangla fact check, applied to every message

NOT_BN = r"(?<![ঀ-৿])"
NOT_BN_AFTER = r"(?![ঀ-৿])"
SOCIAL_BN = re.compile(r"(?:যারা|যাঁরা|যে গ্রাহক|যেসব গ্রাহক|যে ক্রেতা)[^।!?]{0,80}?(?:কিন|কেন|ক্রয়|নিয়েছ|বেছে)|"
                       r"(?:কেনা|ক্রয়কারী) (?:গ্রাহক|ক্রেতা)|অন্য(?:ান্য)? (?:গ্রাহক|ক্রেতা|কাস্টমার)|ক্রেতারা|(?:একসাথে|একসঙ্গে) কেনা")
BEST_BN = re.compile(r"বেস্ট ?সেলার|সবচেয়ে (?:বেশি )?(?:বিক্রি|জনপ্রিয়)|সর্বাধিক (?:বিক্রি|বিক্রী)|জনপ্রিয়|অনেক গ্রাহক|গ্রাহকদের (?:প্রিয়|পছন্দ)")
URGENT_BN = re.compile(r"সীমিত|শেষ সুযোগ|তাড়াতাড়ি|তাড়া|দ্রুত|স্টক|আজই|আজকের|শুধু আজ|মেয়াদ|শেষ হয়ে|ঘণ্টা|ঘন্টা")
NEGATION_BN = re.compile(NOT_BN + r"(?:না|নেই|নয়|নাই|নহে|কখনো|কখনও)" + NOT_BN_AFTER)
FIRST_ORDER_BN = re.compile(r"(?:প্রথম|দ্বিতীয়)\s*(?:অর্ডার|কেনাকাটা|ক্রয়)|দ্বিতীয়বার")  # true only for one-order customers
BN_DIGITS = re.compile("[০-৯]")


def self_check_bn(f, text):
    """The rules of src/ai/aiWording.ts checkMessage with lang 'bn': a message the app would reject is a grammar bug."""
    problems = []
    low = text.lower()
    g = bn_facts(f)
    for k in ("suggest", "price", "offer"):
        if g[k] != "-" and g[k].lower() not in low:
            problems.append(f"missing {k}")
    if g["code"] != "-" and g["code"] not in text:
        problems.append("missing code")
    extra = M.fact_set(text) - M.fact_set(M.to_input(g))
    if extra:
        problems.append(f"new facts {sorted(extra)}")
    if BN_DIGITS.search(text):
        problems.append("Bangla digits")
    rest = text
    for v in [f["suggest"], f["because"], f["shop"]] + f["buys"].split("; "):
        if v != "-":
            rest = rest.replace(v, " ")
    if f["reason"] != "bought together" and SOCIAL_BN.search(rest):
        problems.append("social proof without reason")
    if f["reason"] != "best seller" and BEST_BN.search(rest):
        problems.append("best seller without reason")
    if URGENT_BN.search(rest):
        problems.append("urgency")
    if NEGATION_BN.search(rest):
        problems.append("negation")
    if f["orders"] != "1" and FIRST_ORDER_BN.search(rest):
        problems.append("first or second order claim")
    masked = text  # a product name such as "Organic No. 5 Toner" must not be cut into sentences
    for v in sorted({f["suggest"], f["because"], f["shop"], *f["buys"].split("; ")} - {"-"}, key=len, reverse=True):
        masked = masked.replace(v, "§")
    sentences = [s.strip().lower() for s in re.split(r"(?<=[.!?।])\s+", masked) if s.strip()]
    if len(set(sentences)) < len(sentences):
        problems.append("repeats itself")
    if not 30 <= len(text) <= 700:
        problems.append("length")
    return problems


# ---------------------------------------------------------------- build the data

def records(rows, rng):
    for f in rows:
        if rng.random() < 0.03:  # a shop whose name is not set: the app writes "আমাদের দোকান" (our shop)
            f = {**f, "shop": "আমাদের দোকান"}
        yield {"input": to_input_bn(f), "target": write_message_bn(f, rng), "facts": f}


def main():
    rng = random.Random(2027)
    OUT.mkdir(parents=True, exist_ok=True)
    english = {k: [M.tidy_product(p) for p in v.replace("\n", "").split("|") if p.strip()] for k, v in M.PRODUCTS.items()}
    products = {k: english[k] + [p.strip() for p in PRODUCTS_BN[k].replace("\n", "").split("|") if p.strip()] for k in english}
    # held-out names: the Latin spelling decides, and its Bangla spelling is held out with it
    names_tr, names_te = M.split(M.BD_NAMES + M.INTL_NAMES, rng)
    with_bn = lambda names: names + [NAMES_BN[n] for n in names if n in NAMES_BN]
    names_tr, names_te = with_bn(names_tr), with_bn(names_te)
    shops = {k: [f"{a} {w}" for a in (M.SHOP_PREFIX_INTL if k == "gifts" else M.SHOP_PREFIX_BD) for w in ws] + SHOPS_BN[k]
             for k, ws in M.SHOP_WORDS.items()}
    shops_tr, shops_te, prod_tr, prod_te = {}, {}, {}, {}
    for k, v in shops.items():
        shops_tr[k], shops_te[k] = M.split(v, rng)
    for k, v in products.items():
        prod_tr[k], prod_te[k] = M.split(v, rng)
    for k in M.MARKET:
        prod_tr[f"m_{k}"], prod_te[f"m_{k}"] = M.split({M.market_title(k, rng) for _ in range(1500)}, rng)
        shops_tr[f"m_{k}"], shops_te[f"m_{k}"] = shops_tr[k], shops_te[k]

    uci = M.uci_customers()
    rng.shuffle(uci)
    cut = int(len(uci) * 0.85)
    uci_tr, uci_te = uci[:cut], uci[cut:]
    prod_tr["gifts"], prod_te["gifts"] = M.split({p for c in uci for p in c["top"]}, rng)

    train = list(records(M.synth_customers(14000, rng, names_tr, shops_tr, prod_tr), rng))
    train += list(records(M.uci_rows(uci_tr, names_tr, shops_tr["gifts"], rng, banned=frozenset(prod_te["gifts"])), rng))
    rng.shuffle(train)
    val, train = train[:400], train[400:]
    test_synth = list(records(M.synth_customers(600, rng, names_te, shops_te, prod_te), rng))
    test_uci = list(records(M.uci_rows(uci_te, names_te, shops_te["gifts"], rng), rng))
    bad = [(r, p) for rows in (train, val, test_synth, test_uci) for r in rows for p in [self_check_bn(r["facts"], r["target"])] if p]
    for r, p in bad[:10]:
        print("BAD:", p, "\n  IN :", r["input"], "\n  OUT:", r["target"])
    if bad:
        raise SystemExit(f"{len(bad)} generated messages fail the app's fact check; fix the grammar")
    for name, rows in [("train", train), ("val", val), ("test_synth", test_synth), ("test_uci", test_uci)]:
        with open(OUT / f"{name}.jsonl", "w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{name}: {len(rows)}")
    print("reasons (UCI test):", Counter(r["facts"]["reason"] for r in test_uci))
    print("name scripts (train):", Counter("bn" if re.search("[ঀ-৿]", r["facts"]["name"]) else "latin" for r in train))
    lens = sorted(len(r["target"]) for r in train)
    print("target characters: median", lens[len(lens) // 2], "max", lens[-1])
    for r in train[:8]:
        print("\nIN :", r["input"], "\nOUT:", r["target"])


if __name__ == "__main__":
    main()
