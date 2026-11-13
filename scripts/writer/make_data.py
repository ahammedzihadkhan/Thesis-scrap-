"""Training data for the KroyPulse offline message writer: customer facts -> promotional message.

Two sources of customers:
  * synthetic shop customers (Bangladeshi f-commerce and gift-shop products, names and shops), and
  * real customers of the UCI Online Retail file (thesis/data/online_retail.csv): their most bought products, order
    count, last order and usual reorder gap, and a suggestion picked the way the app picks it (what other customers
    with the same products bought, weighted towards recent purchases; the same type of product; a best seller; and,
    for every fourth customer, a best seller of another type).

The phrase grammar below writes each message with the persuasion principle that suits the customer group:
recognition and reciprocity for the best customers, consistency and social proof for regulars, loss aversion and a
saved reward for customers who are slipping away, a low-effort fresh start for inactive ones, a welcome for new ones.
It only makes claims the facts support: "customers who bought X also bought Y" only when the reason is "bought
together", "best seller" only for best sellers, and an old price ("instead of Tk 1,600") only when the offer is a
percentage discount. There are no deadlines or stock claims, because the shop sets none. Every name, product, number,
price and code in a message is copied from the facts, so the model is never taught to invent one; self_check() below
applies the app's fact check to every generated message.

Run:  scripts/writer/.venv/Scripts/python scripts/writer/make_data.py
Out:  scripts/writer/out/data/{train,val,test_synth,test_uci}.jsonl, one {"input", "target", "facts"} per line.
The synthetic test set uses products, names and shops that never occur in training; the UCI test set holds
real customers that were not used for training.
"""
import csv
import json
import math
import random
import re
import zlib
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "out" / "data"
UCI = ROOT / "thesis" / "data" / "online_retail.csv"
FIELDS = ("segment", "tone", "name", "shop", "buys", "orders", "last order", "usual gap",
          "suggest", "type", "because", "reason", "price", "was", "offer", "code")
SEGMENTS = ("best", "regular", "slipping", "inactive", "promising", "new", "once")
TONES = ("friendly", "friendly", "short", "formal")  # friendly twice as often
REASONS = ("bought together", "same kind", "best seller", "something new")


# ---------------------------------------------------------------- facts (the app builds the same strings)

def ago(days):
    """Last order as words (days >= 1); the same rule is in src/ai/messageFacts.ts."""
    if days <= 1:
        return "1 day ago"
    if days < 14:
        return f"{days} days ago"
    if days < 60:
        return f"{int(days / 7 + 0.5)} weeks ago"
    if days < 365:
        return f"{int(days / 30 + 0.5)} months ago"
    return "over a year ago" if days < 730 else f"{days // 365} years ago"


def every(days):
    """Usual time between orders as words; the same rule is in src/ai/messageFacts.ts."""
    if days < 1.5:
        return "every day"
    if days < 11:
        return f"every {int(days + 0.5)} days"
    if days < 60:
        w = int(days / 7 + 0.5)
        return "every week" if w == 1 else f"every {w} weeks"
    if days < 365:
        mo = int(days / 30 + 0.5)
        return "every month" if mo == 1 else f"every {mo} months"
    return "about once a year"


def tidy_product(name):
    """Drop stray quotes and turn ALL-CAPS catalogue names into Title Case (same rule in the app)."""
    s = re.sub(r"\s+", " ", re.sub(r'["*]', "", name)).strip()
    letters = [c for c in s if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) > 0.7:
        s = re.sub(r"(^|[\s\-(/])([a-z])", lambda m: m.group(1) + m.group(2).upper(), s.lower())
    return s


def short_title(name, max_len=60):
    """Long marketplace titles become a readable name of at most 60 characters (same rule in the app)."""
    if len(name) <= max_len:
        return name
    m = re.search(r"\s(?:for|with)\s|\s[-|]\s|,\s", name, re.I)
    s = name[:m.start()] if m and m.start() >= 20 else name
    if len(s) > max_len:
        i = s.rfind(" ", 0, max_len + 1)
        s = s[:i] if i >= 20 else s[:max_len]
    return re.sub(r"[\s,(-]+$", "", re.sub(r"\s*\([^)]*$", "", s))


_TYPES = json.loads((ROOT / "src" / "rfm" / "productTypes.json").read_text(encoding="utf-8"))
_TYPE_TESTS = [(t, re.compile(r"\b(?:" + "|".join(re.escape(w) for w in _TYPES["words"][t]) + r")(?:s|es)?\b", re.I | re.A))
               for t in _TYPES["order"]]


def product_type(name):
    """Product type from its name; src/rfm/productType.ts applies the same productTypes.json."""
    return next((t for t, rx in _TYPE_TESTS if rx.search(name)), "other")


def money(cur, amount):
    """'Tk 1,250' / '£2.95' / '£3'; the same rule is in src/ai/messageFacts.ts (round half up, as JavaScript)."""
    if cur in ("Tk ", "Rs "):
        return f"{cur}{math.floor(amount + 0.5):,}"
    cents = math.floor(amount * 100 + 0.5) / 100
    return f"{cur}{int(cents):,}" if cents == int(cents) else f"{cur}{cents:,.2f}"


def priced(cur, amount, offer):
    """(price, was): a percentage offer lowers the suggested product's price and keeps the old one for the message."""
    m = re.fullmatch(r"(\d+(?:\.\d+)?)% off", offer)
    if not m:
        return money(cur, amount), "-"
    now, was = money(cur, amount * (1 - float(m.group(1)) / 100)), money(cur, amount)
    return (now, was) if now != was else (now, "-")


def to_input(f):
    return " | ".join(f"{k}: {f[k]}" for k in FIELDS)


# ---------------------------------------------------------------- word lists

BD_NAMES = """Rahim Karim Nusrat Farhana Tanvir Sabbir Mitu Rumana Arif Sumaiya Jannat Tasnim Imran Rakib Shuvo Anika Sadia
Mehedi Riya Joya Fahim Nabila Tahmid Ishrat Shanto Ayesha Hasan Rafi Lamia Puja Ananya Arnob Mahi Sakib Tania Faria
Bristy Shakil Rony Moumita Dipa Sharmin Kamrul Habib Jamal Rima Shila Tushar Asif Naim Rasel Sohel Liza Popy Mim Ratul
Nafisa Sajid Tamanna Rifat Orin Proma Nadia Fardin Rupa Babul Selina Mizan Shirin Hridoy Antara Sourav Priya Monir
Nipa Polash Rubel Shathi Kawsar Lima Sumon Ruma Jewel Keya Masud Ritu Shohag Bonna Alamin Shapla Ridoy Tisha""".split()
INTL_NAMES = """Emma Oliver Sophie James Chloe Harry Grace Jack Lucy Thomas Amelia George Mia William Isla Noah Ella Leo
Freya Henry Claire Daniel Laura Pierre Marie Lukas Anna Sofia Marco Elena Hannah Ben Kate Sam Ruby Alfie Evie Oscar
Lily Charlie Ava Archie Jessica Edward Holly Peter Zoe Nathan Megan Liam Sarah Ryan Alice Dylan Rosie Adam Erin Joseph
Martha Luca Ingrid Mateo Clara Jonas Paula Hugo Nina Felix Julia Tom Fiona""".split()

SHOP_PREFIX_BD = """Dhaka Sylhet Chattogram Rajshahi Khulna Barishal Rangpur Cumilla Bogura Gazipur Narayanganj Mymensingh
Shapla Rongdhonu Nupur Megh Nodi Tara Shonali Kroy Bhalo Ruposhi Anondo Jhinuk Kolpona Akash Bokul Shimul Doel Padma
Meghna Jamuna Karnaphuli Shitol Notun Sobuj Golpo Pakhi Chaya Alo Surjo Mukta Hira Kajol Taranga Ujjal""".split()
SHOP_PREFIX_INTL = """Little Bloom Willow Oak Maple Rose Cosy Retro Kensington Brighton Ivy Hazel Juniper Robin Lantern
Meadow Harbour Cotton Velvet Amber Primrose Bramble Sparrow Copper Linen Thistle Poppy Rowan Heather""".split()
SHOP_WORDS = {
    "fashion": ["Threads", "Boutique", "Fashion House", "Collection", "Style Hub", "Closet", "Attire"],
    "beauty": ["Beauty", "Glow", "Skincare", "Cosmetics", "Beauty Box"],
    "grocery": ["Organics", "Bazaar", "Pantry", "Fresh Mart", "Food Corner", "Grocers"],
    "gadgets": ["Gadgets", "Tech Store", "Mobile Corner", "Electronics", "Gizmo Shop"],
    "home": ["Home Decor", "Kitchen Store", "Living", "Crafts", "Home Store"],
    "kids": ["Kids World", "Baby Shop", "Toy House", "Little Ones"],
    "gifts": ["Gift House", "Gift Shop", "Gift Corner", "Home and Gifts", "Gifts and Co"],
}

PRODUCTS = {
    "fashion": """Cotton Three-Piece Set|Jamdani Saree|Tangail Cotton Saree|Georgette Kurti|Printed Hijab|Silk Dupatta|
Embroidered Salwar Kameez|Lawn Three-Piece|Katan Silk Saree|Chiffon Orna|Block Print Kurti|Black Abaya|Cotton Leggings|
Cotton Panjabi|Silk Festive Panjabi|Formal Shirt|Polo T-Shirt|Denim Jeans|Chino Pants|Batik Lungi|Leather Sandals|
Prayer Cap|Kabli Set|Cotton Fatua|Leather Belt|Leather Wallet|Handloom Gamcha|Party Gown|Kids Panjabi|Linen Shirt|
Embroidered Shawl|Winter Hoodie|Sports Sneakers|Ladies Handbag|Gold-Plated Earrings|Bangle Set|Silk Tie|Cargo Shorts|
Maxi Dress|Palazzo Pants|Kashmiri Shawl|Nakshi Kantha Stole|Cotton Shirt (Sky Blue)|Executive Silk Festive Panjabi (Royal Blue)|
Handloom Dhakai Jamdani Saree (Royal Navy)|Hand-Embroidered Cotton Panjabi (Charcoal)|Silk Katan Dupatta & Jamdani Clutch Set""",
    "beauty": """Aloe Vera Face Wash|Matte Lipstick (Ruby Red)|Herbal Hair Oil|Sunscreen SPF 50|Kajal Pencil|Rose Water Toner|
Vitamin C Serum|Henna Cone (Pack of 6)|Neem Soap|Body Lotion|Oud Attar|Perfume Gift Box|Night Cream|Charcoal Face Mask|
Lip Balm Set|Nail Polish Kit|Hair Serum|Shampoo (Anti-Dandruff)|Coconut Oil|Face Powder|Makeup Brush Set|Eyeliner Pen|
Tea Tree Face Wash|Beard Oil|Hair Dryer|Glycerin Soap|Foundation (Natural Beige)|Hand Cream|Lip Gloss|Saffron Face Pack""",
    "grocery": """Sundarban Honey (500g)|Mustard Oil (1 Litre)|Chinigura Rice (5kg)|Ajwa Dates (1kg)|Pure Ghee (400g)|
Premium Tea Leaves (500g)|Mixed Nuts (250g)|Mango Pickle|Kalojeera Oil|Organic Turmeric Powder|Red Chilli Powder|
Brown Sugar (1kg)|Date Molasses|Lentils (Masoor, 1kg)|Puffed Rice (Muri)|Dried Fish (Loitta)|Fresh Mango Box|
Black Seed Honey|Green Tea Bags|Cashew Nuts (250g)|Almonds (500g)|Coconut Milk Powder|Basmati Rice (5kg)|Chia Seeds|
Organic Jaggery|Cold-Pressed Ghani Mustard Oil (1 Litre)|Sundarban Raw Wild Forest Honey (500g Jar)|Dinajpur Kalojeera Polao Rice (5kg)""",
    "gadgets": """Wireless Earbuds|Power Bank (20000mAh)|Fast Charger (25W)|Silicone Phone Cover|Smart Watch|Bluetooth Speaker|
USB-C Cable|Ring Light|Laptop Stand|Gaming Mouse|Tempered Glass Protector|Neckband Headphones|Mini Fan|Smart Bulb|
Wi-Fi Router|Memory Card (64GB)|Webcam|Mechanical Keyboard|Car Charger|Selfie Stick|Digital Kitchen Scale|Trimmer|
Desk Lamp|Phone Holder|Portable SSD|Fitness Band|Tripod Stand|HDMI Cable""",
    "home": """Non-Stick Fry Pan|Rice Cooker|Nakshi Kantha Cushion Cover|Cotton Bed Sheet Set|Terracotta Tea Set|Wall Clock|
Prayer Mat|Bamboo Basket|Ceramic Dinner Set|Kitchen Blender|Jute Rug|Wooden Spice Rack|Glass Water Jug|Table Runner|
Steel Water Bottle|Pressure Cooker|Scented Candle Set|Photo Frame Set|Laundry Basket|Door Mat|Clay Flower Vase|
Kitchen Towel Set|Storage Jar Set|Brass Lamp|Handcrafted Nakshi Kantha Quilt (Queen Size)|Handmade Terracotta Tea Cup & Saucer Set (6 Pcs)""",
    "kids": """Kids Cotton Frock|Baby Romper|School Bag|Story Book Set|Building Blocks|Kids Sandals|Kids Water Bottle|
Colour Pencil Box|Baby Blanket|Toy Car|Puzzle Set|Baby Feeding Bottle|Kids Raincoat|Soft Teddy Bear|Drawing Book|
Baby Diaper Pack|Kids Lunch Box|Alphabet Flash Cards|Doll House|Kids Cap""",
}
PRICE_RANGE = {"fashion": (350, 8500), "beauty": (120, 2800), "grocery": (90, 2400), "gadgets": (150, 6500),
               "home": (180, 6000), "kids": (150, 3500)}

# Long marketplace titles, as Daraz and Facebook sellers write them ("Mini i8 2.4GHz Backlit Wireless Keyboard for PC TV Box").
MARKET = {
    "gadgets": {"pre": "Mini|Portable|Wireless|Rechargeable|Smart|Ultra Slim|Waterproof|Original|Premium|Universal|Foldable|Magnetic|Fast Charging",
                "spec": "2.4GHz|Bluetooth 5.0|Bluetooth 5.3|20000mAh|10000mAh|65W|25W|1080P|4K|3 in 1|2 in 1|IPX7|Type-C|USB 3.0|LED|RGB|128GB|64GB|Backlit|Noise Cancelling",
                "noun": "Keyboard|Mouse|Earbuds|Headphone|Speaker|Power Bank|Charger|Adapter|Smart Watch|Phone Case|USB Cable|Ring Light|Webcam|Router|Trimmer|Table Fan|Selfie Stick|Tripod|Laptop Stand|Memory Card|Keyboard Touchpad|Receiver Transmitter",
                "post": "for PC TV Box Android|for iPhone and Samsung|for Laptop and Mobile|with Mic|with Remote|for Gaming|(Black)|(White)|- 2 Pack|for Car and Home|with LED Display",
                "code": "i8|X9|M10|A1 Pro|T900|K7|Q12|V8|S20|H6"},
    "fashion": {"pre": "Women's|Men's|Stylish|Trendy|Premium|Soft|Exclusive|New|Casual|Party Wear|Summer|Winter|Kids",
                "spec": "Cotton|Silk|Georgette|Linen|Denim|Chiffon|Lawn|Velvet|Embroidered|Printed|Block Print|Slim Fit|Free Size|Full Sleeve|Half Sleeve|Handloom",
                "noun": "Kurti|Three Piece|Saree|Panjabi|T-Shirt|Shirt|Hoodie|Jeans Pant|Hijab|Abaya|Gown|Shalwar Kameez|Polo Shirt|Leggings|Sandal|Sneakers|Lehenga",
                "post": "for Eid|for Women|for Men|for Girls|(Free Size)|(Black)|(Maroon)|- Unstitched|with Dupatta|for Party and Wedding|(M, L, XL)",
                "code": "Style 21|Design 07|Code 4410|Model 19"},
    "beauty": {"pre": "Original|Organic|Herbal|Natural|Korean|Premium|Imported|Vegan|Long Lasting",
               "spec": "100ml|50ml|200g|SPF 50|Vitamin C|Aloe Vera|Hyaluronic Acid|Niacinamide 10%|Rose|Charcoal|Tea Tree|Matte|Waterproof",
               "noun": "Face Wash|Serum|Sunscreen|Night Cream|Lipstick|Hair Oil|Shampoo|Face Mask|Body Lotion|Perfume|Kajal|Foundation|Toner",
               "post": "for Oily Skin|for Dry Skin|for Men and Women|(Pack of 2)|- Combo|for Hair Fall|for Glowing Skin",
               "code": "No. 5|Shade 12|Batch 2024"},
    "home": {"pre": "Premium|Heavy Duty|Non-Stick|Stainless Steel|Handmade|Wooden|Ceramic|Electric|Automatic|Multi-Purpose",
             "spec": "1.8 Litre|5 Litre|3 Piece|6 Piece|Queen Size|King Size|LED|1200W|Waterproof|Foldable|Glass",
             "noun": "Rice Cooker|Fry Pan|Blender|Bed Sheet|Wall Clock|Dinner Set|Storage Box|Water Bottle|Table Lamp|Curtain|Prayer Mat|Cushion Cover|Kettle",
             "post": "for Kitchen|for Home and Office|with Lid|(Random Color)|- Combo Pack|for Bedroom|with 1 Year Warranty",
             "code": "Model 2023|HX-200|BD-15"},
}


def market_title(kind, rng):
    p = {k: v.split("|") for k, v in MARKET[kind].items()}
    parts = ([rng.choice(p["pre"])] if rng.random() < 0.7 else []) + rng.sample(p["spec"], rng.choice([1, 1, 2]))
    if rng.random() < 0.3:
        parts.insert(min(1, len(parts)), rng.choice(p["code"]))
    parts.append(rng.choice(p["noun"]))
    if rng.random() < 0.7:
        parts.append(rng.choice(p["post"]))
    return " ".join(dict.fromkeys(parts))


DEFAULT_CODES = {"best": ("20% off", "VIP-CURATED20"), "regular": ("15% off", "PAIR-IT15"),
                 "slipping": ("15% off", "REVIVE-GIFT15"), "inactive": ("25% off", "WINBACK25"),
                 "promising": ("10% off", "THANKS10"), "new": ("free delivery", "-"), "once": ("10% off", "SECOND10")}
CODE_WORDS = """SAVE VIP BACK HELLO EID BOISHAKH WELCOME THANKS LOYAL MISSYOU COMEBACK NEW GIFT FRIEND SPECIAL TREAT BONUS
HAPPY SHOP NEXT PAIR STYLE GLOW FRESH TECH RETURN SMILE DEAL EXTRA PRIME""".split()

# ---------------------------------------------------------------- phrase grammar
# {N} name, {S} shop, {B1} top product, {BL} top two products, {O} orders, {L} last order ("2 weeks ago"),
# {LD} the same as a duration ("2 weeks"), {G} usual gap, {P} suggested product, {PR} its price (after a percentage
# offer), {W} its old price, {OF} offer, {C} code, {BC} the bought product the suggestion comes from, {TB} what the
# product type does for the customer ("complete your setup"). A line is used only when all of its facts exist.

TYPE_BENEFIT = {
    "electronics": ["complete your setup", "get even more from your gadgets", "upgrade your setup"],
    "fashion": ["complete your look", "refresh your wardrobe", "finish off your outfit"],
    "beauty": ["complete your routine", "treat your skin", "pamper yourself"],
    "grocery": ["stock up your kitchen", "keep your pantry full", "add flavour to your meals"],
    "home": ["make your home even cosier", "brighten up your home", "give your home a fresh touch"],
    "kids": ["delight your little one", "make your little one smile"],
    "gifts": ["treat someone special", "make someone smile", "brighten someone's day"],
}

OPEN = {
    "friendly": ["Hi {N}!", "Hello {N}!", "Hey {N}!", "Hi {N},", "Hello {N},", "Hi there!", "Hello!", "Hi!", "Hello from {S}!"],
    "formal": ["Dear {N},", "Hello {N},", "Dear valued customer,", "Dear customer,", "Greetings from {S}."],
}

HOOK = {  # one or two per message: the psychological opener of each customer group
    "best": {  # recognition, belonging, reciprocity
        "friendly": ["You're one of our very best customers, and we're so grateful!",
                     "{O} orders and counting - you're truly part of the {S} family!",
                     "Thank you for {O} orders - customers like you are the heart of {S}.",
                     "We've noticed how much you love {B1}, so we kept you in mind.",
                     "You shop with us {G}, and it means the world to us.",
                     "Your love for {BL} inspired us to pick something just for you.",
                     "We always smile when we pack your orders, especially your {B1}!",
                     "Your taste in {B1} is spot on, so we picked a treat for you."],
        "formal": ["Thank you for being one of the most valued customers of {S}.",
                   "We are sincerely grateful for your {O} orders with {S}.",
                   "Your loyalty means a great deal to everyone at {S}.",
                   "We have noticed your continued interest in {BL}, and we have selected something special for you.",
                   "As you shop with us {G}, we wanted to thank you personally."],
    },
    "regular": {  # consistency with their habit, liking
        "friendly": ["You usually order {G}, so we thought of you first!",
                     "It's been {LD} since your last order - perfect timing for something new.",
                     "Thanks for being a regular - {O} orders and counting!",
                     "We love seeing you come back for more {B1}!",
                     "Since you love {BL}, we picked something just for you.",
                     "You clearly know a good thing when you see it - your {B1} proves it!",
                     "Your last order was {L}, and we've been saving a little something for you.",
                     "Your {B1} orders always make us smile!"],
        "formal": ["As you usually shop with us {G}, we would like to share a recommendation with you.",
                   "Thank you for your {O} orders with {S}.", "We hope you are enjoying your {B1}.",
                   "Your last order was {L}, and we have selected something new for you.",
                   "We truly value your regular orders at {S}."],
    },
    "slipping": {  # being missed, empathy, a reward already saved (loss aversion)
        "friendly": ["It's been {LD} since your last order, and we've missed you!",
                     "We miss you at {S}! Your last order was {L}.",
                     "Hope you're still enjoying your {B1}! It's been a little while.",
                     "You used to order {G}, and we've really missed seeing you!",
                     "Life gets busy - we get it! So we've made coming back easy.",
                     "We noticed your last order was {L}, so we saved something special for you.",
                     "Your favourite {B1} is still here whenever you need it."],
        "formal": ["We have missed you at {S}; your last order was {L}.", "We hope you are still enjoying your {B1}.",
                   "It has been {LD} since your last visit, and we would be delighted to welcome you back.",
                   "We value you as a customer and would love to see you again at {S}."],
    },
    "inactive": {  # warm welcome back, low effort fresh start
        "friendly": ["It's been a while since your last order ({L}), and we'd love to have you back!",
                     "We'd love to welcome you back to {S}!", "Remember your {B1}? We'd love to see you again!",
                     "A fresh start at {S} is just one reply away.", "It's been {LD} - we've missed you!",
                     "We've been thinking of you since your last order {L}!",
                     "We'd love to see you back at {S} soon!"],
        "formal": ["It has been some time since your last order with {S} ({L}).",
                   "We would be delighted to welcome you back to {S}.",
                   "We hope you enjoyed your {B1}, and we would be glad to serve you again."],
    },
    "promising": {  # progress and encouragement
        "friendly": ["{O} orders already - you're quickly becoming one of our favourite customers!",
                     "Thanks for coming back to {S} - it means a lot!", "We're so glad you came back for more {B1}!",
                     "You're off to a great start with {S}!",
                     "Your {B1} was a great choice, and we have another one for you!"],
        "formal": ["Thank you for returning to {S}.", "We are delighted that you have already placed {O} orders with us.",
                   "We are glad you enjoyed your {B1} and chose us again."],
    },
    "new": {  # welcome and reassurance
        "friendly": ["Welcome to the {S} family, and thank you for your first order!",
                     "We hope your {B1} arrived safely and you're loving it!",
                     "Thanks for choosing {S} - we're so happy to have you!", "It was a joy to pack your first order!",
                     "We're thrilled you chose {B1} for your first order!"],
        "formal": ["Welcome to {S}, and thank you for your first order.", "We hope your {B1} has met your expectations.",
                   "Thank you for choosing {S} for your first purchase."],
    },
    "once": {  # re-engagement through their first purchase
        "friendly": ["How are you finding your {B1}? We'd love to hear!",
                     "It's been {LD} since your order, and we'd love to see you again!",
                     "We still remember packing your {B1}!", "Your first order was {L} - ready for round two?",
                     "Your {B1} was a great choice!"],
        "formal": ["We hope you are happy with your {B1}.", "Thank you once again for your order {L}.",
                   "We would be delighted to serve you again at {S}."],
    },
}

# The suggestion, by why it was chosen. Only "together" lines say what other customers bought.
PITCH = {
    "together": {
        "friendly": ["Customers who bought {BC} also bought {P}.", "Shoppers who picked up {BC} often add {P} too.",
                     "{P} is often bought together with {BC}.", "Customers who bought {BC} also picked up {P} to {TB}.",
                     "Here's a tip from other shoppers: people who bought {BC} also chose {P}."],
        "formal": ["Customers who purchased {BC} also purchased {P}.", "{P} is frequently chosen by customers who bought {BC}.",
                   "Customers who bought {BC} often also choose {P} to {TB}."],
    },
    "similar": {
        "friendly": ["Since you liked {BC}, we think you'll love {P}.", "If you enjoyed {BC}, {P} is right up your street.",
                     "Love your {BC}? Then you'll want to see {P}.", "More of what you love: {P}, to {TB}.",
                     "You have great taste - {P} is the perfect follow-up to your {BC}."],
        "formal": ["Based on your interest in {BC}, we recommend {P}.", "As you enjoyed {BC}, you may also appreciate {P}.",
                   "Given your interest in {BC}, we believe {P} will suit you well."],
    },
    "best": {
        "friendly": ["{P} is one of our best sellers.", "{P} is one of our most popular picks.",
                     "Join the many customers who chose {P}.", "Our best seller {P} is a great way to {TB}."],
        "formal": ["{P} is one of our best-selling products.", "We would like to recommend {P}, one of our most popular items.",
                   "Many of our customers choose {P} to {TB}."],
    },
    "new": {
        "friendly": ["Fancy something different? Try {P}.", "Something new for you this time: {P}.",
                     "Time to try something new: {P}.", "Ready to explore? {P} could be your next favourite.",
                     "Treat yourself to something different: {P}, a lovely way to {TB}."],
        "formal": ["We would like to introduce you to something new: {P}.", "You may enjoy discovering {P}.",
                   "For a change, we recommend {P} to {TB}."],
    },
    "none": {
        "friendly": ["We picked {P} especially for you.", "Have a look at {P}.", "You might like {P}.",
                     "{P} is a lovely way to {TB}."],
        "formal": ["We have selected {P} for you.", "You may be interested in {P}.", "We recommend {P} to {TB}."],
    },
}
PITCH_PRICE = {  # the same with the regular price (no percentage offer)
    "together": {
        "friendly": ["Customers who bought {BC} also bought {P} - and it's just {PR}.",
                     "Shoppers who picked up {BC} often add {P} too, just {PR}.",
                     "{P} is often bought together with {BC}, and it's only {PR}.",
                     "Customers who bought {BC} also picked up {P} to {TB} - just {PR}."],
        "formal": ["Customers who purchased {BC} also purchased {P}, available at {PR}.",
                   "{P}, available at {PR}, is frequently chosen by customers who bought {BC}."],
    },
    "similar": {
        "friendly": ["Since you liked {BC}, we think you'll love {P} - just {PR}.",
                     "If you enjoyed {BC}, {P} is right up your street at {PR}.",
                     "Love your {BC}? Then you'll love {P}, only {PR}.", "More of what you love: {P}, just {PR}."],
        "formal": ["Based on your interest in {BC}, we recommend {P}, available at {PR}.",
                   "As you enjoyed {BC}, you may also appreciate {P}, priced at {PR}."],
    },
    "best": {
        "friendly": ["{P} is one of our best sellers, and it's just {PR}.", "{P} is one of our most popular picks - only {PR}.",
                     "Join the many customers who chose {P}, just {PR}."],
        "formal": ["{P}, one of our best-selling products, is available at {PR}.",
                   "We recommend {P}, one of our most popular items, at {PR}."],
    },
    "new": {
        "friendly": ["Fancy something different? Try {P} - just {PR}.", "Something new for you this time: {P}, only {PR}.",
                     "Ready to explore? {P} could be your next favourite, just {PR}."],
        "formal": ["We would like to introduce you to something new: {P}, available at {PR}.",
                   "You may enjoy discovering {P}, priced at {PR}."],
    },
    "none": {
        "friendly": ["We picked {P} especially for you - just {PR}.", "Have a look at {P}, only {PR}.",
                     "You might like {P}, just {PR}."],
        "formal": ["We have selected {P} for you, available at {PR}.", "You may be interested in {P}, priced at {PR}."],
    },
}

OFFER = {  # offer with a code, framed for the group
    "best": {"friendly": ["As a thank-you, here's {OF} with your VIP code {C}.", "Your VIP reward: {OF} with code {C}.",
                          "Just for our VIPs: {OF} with code {C}.", "Use your VIP code {C} for {OF}."],
             "formal": ["As a token of our appreciation, your code {C} gives you {OF}.",
                        "In appreciation of your loyalty, please use code {C} to receive {OF}."]},
    "regular": {"friendly": ["Your loyalty reward: {OF} with code {C}.", "Use code {C} to get {OF}.",
                             "Here's {OF} on your next order with code {C}.", "Because you're a regular, code {C} gets you {OF}."],
                "formal": ["As a thank-you for your regular orders, please use code {C} to receive {OF}.",
                           "Please use code {C} to receive {OF}."]},
    "slipping": {"friendly": ["We've saved {OF} for you - just use code {C}.", "To welcome you back, here's {OF} with code {C}.",
                              "{OF} is ready and waiting for you - just use code {C}.", "Come back for {OF} with code {C}."],
                 "formal": ["To welcome you back, we have set aside {OF} for you with code {C}.",
                            "Please use code {C} to receive {OF} on your return."]},
    "inactive": {"friendly": ["Here's {OF} to welcome you back - use code {C}.", "Your welcome-back reward: {OF} with code {C}.",
                              "Come back with {OF} using code {C}.", "Code {C} gets you {OF} on your comeback order."],
                 "formal": ["To welcome you back, please use code {C} to receive {OF}.",
                            "We would like to offer you {OF} with code {C} on your return."]},
    "promising": {"friendly": ["As a thank-you, here's {OF} on your next order with code {C}.", "Keep it going with {OF} - code {C}.",
                               "Use code {C} for {OF} on your next order."],
                  "formal": ["As a thank-you, please use code {C} to receive {OF} on your next order."]},
    "new": {"friendly": ["Your second order gets {OF} with code {C}.", "Use code {C} on your second order for {OF}.",
                         "Welcome gift: {OF} on your second order with code {C}."],
            "formal": ["Please use code {C} on your second order to receive {OF}."]},
    "once": {"friendly": ["Your second order gets {OF} with code {C}.", "Come back for {OF} with code {C}.",
                          "Use code {C} for {OF} on your second order."],
             "formal": ["Please use code {C} on your second order to receive {OF}."]},
}
OFFER_NOCODE = {
    "friendly": ["Your next order comes with {OF}!", "Enjoy {OF} on your next order!", "Plus, your next order comes with {OF}."],
    "formal": ["Your next order will include {OF}.", "You will receive {OF} on your next order."],
}
# A percentage offer on the suggested product: the old price next to the new one (anchoring).
DEAL = {
    "friendly": ["With code {C}, that's {OF}: just {PR} instead of {W}.", "That's {OF} with code {C} - just {PR} instead of {W}.",
                 "Use code {C} for {OF} and it's yours for {PR} instead of {W}.",
                 "Your code {C} takes {OF}, so it's just {PR} instead of {W}."],
    "formal": ["With code {C}, you will receive {OF}: {PR} instead of {W}.",
               "Using code {C}, you receive {OF}, bringing the price to {PR} instead of {W}."],
}
DEAL_SEG = {
    ("best", "friendly"): ["As a thank-you, your VIP code {C} gives you {OF}: just {PR} instead of {W}."],
    ("regular", "friendly"): ["Your loyalty reward: {OF} with code {C}, just {PR} instead of {W}."],
    ("slipping", "friendly"): ["We've saved {OF} for you with code {C} - just {PR} instead of {W}."],
    ("inactive", "friendly"): ["Welcome back with {OF}: code {C} makes it just {PR} instead of {W}."],
    ("promising", "friendly"): ["As a thank-you, code {C} gives you {OF}: just {PR} instead of {W}."],
    ("new", "friendly"): ["Your second order gets {OF} with code {C}, so it's just {PR} instead of {W}."],
    ("once", "friendly"): ["Your second order gets {OF} with code {C}, so it's just {PR} instead of {W}."],
    ("best", "formal"): ["As a token of our appreciation, your code {C} gives you {OF}: {PR} instead of {W}."],
}
DEAL_NOCODE = {"friendly": ["That's {OF}: just {PR} instead of {W}."], "formal": ["This includes {OF}: {PR} instead of {W}."]}
DEAL_AFTER_OFFER = {"friendly": ["With your code, it's just {PR} instead of {W}.", "That makes it just {PR} instead of {W}."],
                    "formal": ["With your code, the price is {PR} instead of {W}."]}
CTA = {  # one small, easy step
    "friendly": ["Just reply YES and we'll get it ready for you.", "Reply YES and we'll take care of the rest.",
                 "Want it? Just reply YES!", "Simply reply to this message to order.",
                 "Reply here and we'll sort everything out for you.", "Reply YES to grab yours.", "Tap reply and say YES!",
                 "Just say YES and it's on its way to you.", "Reply YES and we'll pack it for you."],
    "formal": ["Simply reply to this message to place your order.", "Please reply YES and we will arrange everything for you.",
               "We look forward to hearing from you.", "Kindly reply to this message if you would like to order."],
}
SIGN = {
    "friendly": ["- the {S} team", "Warmly, {S}", "With love, {S}", "Cheers, the {S} team", "Thanks, the {S} team",
                 "See you soon! - {S}", "- {S}"],
    "formal": ["Kind regards, {S}", "Best regards, the {S} team", "Warm regards, {S}", "Sincerely, {S}", "With thanks, {S}"],
}

SHORT_OPEN = {
    "best": ["{N}, you're one of our VIPs!", "VIP treat for {N}!", "Thank you, {N}!", "A VIP thank-you!"],
    "regular": ["{N}, time for your usual?", "Hi {N}! Thanks for being a regular.", "Time for your usual?"],
    "slipping": ["{N}, we miss you!", "Miss you, {N}!", "We miss you!"],
    "inactive": ["{N}, come back to {S}!", "Long time no see, {N}!", "Come back to {S}!"],
    "promising": ["Thanks for coming back, {N}!", "Great to see you again, {N}!", "Thanks for coming back!"],
    "new": ["Welcome to {S}, {N}!", "Thanks for your first order, {N}!", "Welcome to {S}!"],
    "once": ["{N}, ready for round two?", "Hi {N}, we'd love to see you again!", "Ready for round two?"],
}
SHORT_PITCH = {
    "together": ["Others who bought {BC} also got {P}.", "Bought {BC}? Customers like you also got {P}.",
                 "{BC} buyers also pick {P}."],
    "similar": ["Loved {BC}? Try {P}.", "Like {BC}? You'll love {P}.", "More like your {BC}: {P}."],
    "best": ["Best seller: {P}.", "Our most popular pick: {P}.", "Customer favourite: {P}."],
    "new": ["Something new: {P}.", "Try something different: {P}.", "New for you: {P}."],
    "none": ["Try {P}.", "Picked for you: {P}."],
}
SHORT_PERSONAL = ["Loved your {B1}?", "Enjoying your {B1}?", "More {B1}?"]
SHORT_DEAL = ["{OF} with {C}: {PR} (was {W}).", "{PR} with code {C} (was {W}) - that's {OF}.", "Use {C} for {OF}: {PR} instead of {W}."]
SHORT_DEAL_NOCODE = ["{OF}: {PR} (was {W})."]
SHORT_PRICE = ["Just {PR}.", "Only {PR}."]
SHORT_OFFER = ["{OF} with code {C}.", "Use {C} for {OF}."]
SHORT_OFFER_NOCODE = ["{OF} on your next order!", "Next order: {OF}!"]
SHORT_CTA = ["Reply YES!", "Reply to order.", "Just reply YES."]
SHORT_CTA_NONE = ["Reply anytime to order.", "Message us anytime to order."]
SHORT_SIGN = ["- {S}", "{S}", ""]

REASON_KEY = {"bought together": "together", "same kind": "similar", "best seller": "best", "something new": "new"}
TIME_RE = re.compile(r"\bago\b|while|since|last order|miss", re.I)
SLOT = re.compile(r"\{(\w+)\}")


def fill(line, ctx):
    if any(ctx.get(k) is None for k in SLOT.findall(line)):
        return None
    out = SLOT.sub(lambda m: ctx[m.group(1)], line)
    return out[0].upper() + out[1:] if out else out


def usable(lines, ctx):
    return [s for s in (fill(line, ctx) for line in lines) if s]


def pick(lines, ctx, rng):
    options = usable(lines, ctx)
    return rng.choice(options) if options else None


def pick_named(lines, ctx, rng):
    """Always use the customer's name when we know it (v2 used it 90% of the time; the model then often dropped it)."""
    options = usable(lines, ctx)
    named = [s for s in options if ctx["N"] and ctx["N"] in s]
    return rng.choice(named or options)


def write_message(f, rng):
    """One message for facts f, picked at random from the grammar."""
    seg, tone = f["segment"], f["tone"]
    buys = [] if f["buys"] == "-" else f["buys"].split("; ")
    val = lambda k: None if f[k] == "-" else f[k]
    orders = int(f["orders"])
    last = val("last order")
    benefit = TYPE_BENEFIT.get(f["type"])
    ctx = {"N": val("name"), "S": f["shop"], "B1": buys[0] if buys else None,
           "BL": " and ".join(buys[:2]) if buys else None, "O": str(orders) if orders >= 2 else None,
           "L": last, "LD": last[:-4] if last and last.endswith(" ago") else None, "G": val("usual gap"),
           "P": val("suggest"), "PR": val("price"), "W": val("was"), "OF": val("offer"), "C": val("code"),
           "BC": val("because"), "TB": rng.choice(benefit) if benefit else None}
    key = REASON_KEY.get(f["reason"], "none")
    if key in ("together", "similar") and not ctx["BC"]:
        key = "none"
    names_bought = key in ("together", "similar")  # the pitch names a product they bought
    has_buy = lambda s: ctx["B1"] is not None and ctx["B1"] in s

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


# ---------------------------------------------------------------- the app's fact check, applied to every message

FACT_RE = re.compile(r"https?://\S+|www\.\S+|[\w.+-]+@[\w-]+\.\w+|\b[A-Z][A-Z0-9-]*\d[A-Z0-9-]*\b|\d+(?:[.,]\d+)*\s*%?")
SOCIAL_RE = re.compile(r"who (?:bought|purchased|picked up)|buyers also|also (?:bought|purchased|got|picked|chose|choose)|"
                       r"often add|bought together|frequently chosen", re.I)
BEST_RE = re.compile(r"best[- ]sell|most popular|customer favourite", re.I)
NEGATION_RE = re.compile(r"\b(?:not|never|no longer|cannot|can't|don't|doesn't|won't|isn't|aren't)\b", re.I)
FIRST_ORDER_RE = re.compile(r"\b(?:first|second) (?:order|purchase)\b|round two", re.I)  # true only for one-order customers


def fact_set(s):
    return {re.sub(r"\s+", "", x).lower() for x in FACT_RE.findall(s)}


def self_check(f, text):
    """The rules of src/ai/aiWording.ts checkMessage: a message the app would reject is a grammar bug."""
    problems = []
    low = text.lower()
    for k in ("suggest", "price", "offer"):
        if f[k] != "-" and f[k].lower() not in low:
            problems.append(f"missing {k}")
    if f["code"] != "-" and f["code"] not in text:
        problems.append("missing code")
    extra = fact_set(text) - fact_set(to_input(f))
    if extra:
        problems.append(f"new facts {sorted(extra)}")
    rest = text
    for v in [f["suggest"], f["because"], f["shop"]] + f["buys"].split("; "):
        if v != "-":
            rest = rest.replace(v, " ")
    if f["reason"] != "bought together" and SOCIAL_RE.search(rest):
        problems.append("social proof without reason")
    if f["reason"] != "best seller" and BEST_RE.search(rest):
        problems.append("best seller without reason")
    if NEGATION_RE.search(rest):
        problems.append("negation")
    if f["orders"] != "1" and FIRST_ORDER_RE.search(rest):
        problems.append("first or second order claim")
    if not 30 <= len(text) <= 600:
        problems.append("length")
    return problems


# ---------------------------------------------------------------- customers

def offer_for(seg, rng, name):
    r = rng.random()
    if r < 0.35:
        of, code = DEFAULT_CODES[seg]
    elif r < 0.85:
        kind = rng.random()
        pct = rng.choice([5, 10, 10, 12, 15, 15, 20, 20, 25, 30, 40])
        of = f"{pct}% off" if kind < 0.75 else ("free delivery" if kind < 0.88 else "a free gift" if kind < 0.96 else "a special discount")
        word = rng.choice(CODE_WORDS)
        tail = str(pct) if of.endswith("off") else rng.choice(["", str(rng.randint(1, 99))])
        if name != "-" and rng.random() < 0.1:
            word = re.sub(r"[^A-Z]", "", name.upper())[:8] or word
        code = rng.choice([f"{word}{tail}", f"{word}-{tail}" if tail else word])
    elif r < 0.93:
        of, code = rng.choice(["10% off", "15% off", "free delivery", "a free gift"]), "-"
    else:
        of, code = "-", "-"
    return of, code


def habit_numbers(seg, rng):
    """orders, days since last order, usual gap in days (None for one order)."""
    lo_hi = {"best": ((8, 60), (1, 25), (7, 45)), "regular": ((3, 25), (3, 45), (10, 60)),
             "slipping": ((2, 15), (40, 150), (15, 90)), "inactive": ((2, 12), (120, 700), (20, 180)),
             "promising": ((2, 4), (2, 60), (5, 40)), "new": ((1, 1), (2, 60), None), "once": ((1, 1), (91, 400), None)}
    (o1, o2), (d1, d2), gap = lo_hi[seg]
    orders = rng.randint(o1, o2)
    return orders, rng.randint(d1, d2), (rng.uniform(*gap) if gap and orders >= 2 else None)


def facts(seg, tone, name, shop, buys, orders, days, gap, suggest, because, reason, cur, amount, rng):
    of, code = offer_for(seg, rng, name)
    buys = list(dict.fromkeys(short_title(b) for b in buys))
    suggest = short_title(suggest) if suggest else None
    because = short_title(because) if suggest and because else None
    price, was = priced(cur, amount, of) if suggest else ("-", "-")
    return {"segment": seg, "tone": tone, "name": name, "shop": shop, "buys": "; ".join(buys) if buys else "-",
            "orders": str(orders), "last order": ago(days) if rng.random() > 0.04 else "-",
            "usual gap": every(gap) if gap is not None and rng.random() > 0.1 else "-",
            "suggest": suggest or "-", "type": product_type(suggest) if suggest else "-", "because": because or "-",
            "reason": reason if suggest else "-", "price": price, "was": was, "offer": of, "code": code}


def split(items, rng, frac=0.15):
    items = sorted(set(items))
    rng.shuffle(items)
    k = max(1, int(len(items) * frac))
    return items[k:], items[:k]


def synth_price(kind, rng):
    base = kind.removeprefix("m_")
    if base == "gifts":
        return rng.choices(["£", "€", "$"], [0.7, 0.15, 0.15])[0], round(rng.uniform(0.4, 25), 2)
    cur = rng.choices(["Tk ", "$", "Rs "], [0.9, 0.05, 0.05])[0]
    lo, hi = PRICE_RANGE[base]
    return (cur, round(rng.uniform(lo, hi), -1)) if cur != "$" else (cur, round(rng.uniform(lo, hi) / 110, 2))


def synth_customers(n, rng, names, shops, products):
    rows = []
    kinds = list(products)
    plain = [k for k in kinds if not k.startswith("m_") and k != "gifts"]
    for _ in range(n):
        kind = rng.choice(kinds)
        pool = products[kind]
        base = kind.removeprefix("m_")  # m_* = long marketplace titles of that kind
        seg, tone = rng.choice(SEGMENTS), rng.choice(TONES)
        name = rng.choice(names) if rng.random() < 0.8 else "-"
        shop = rng.choice(shops[kind])
        k = rng.choices([1, 2, 3], [0.4, 0.35, 0.25])[0] if base == kind else rng.choice([1, 1, 2])
        k = min(k, len(pool) - 1)  # the held-out test pools are small
        picked = rng.sample(pool, min(len(pool), k + 2))
        buys, suggest = picked[:k], picked[k]
        other = picked[k + 1] if len(picked) > k + 1 else None
        r = rng.random()
        reason = "bought together" if r < 0.4 else "same kind" if r < 0.6 else "best seller" if r < 0.8 else \
                 "something new" if r < 0.95 else "-"
        because = None
        if reason in ("bought together", "same kind"):
            # usually one of their top products, sometimes another product they bought
            because = rng.choice(buys) if rng.random() < 0.7 or other is None else other
        price_kind = kind
        if reason == "something new":  # a product of a type they have not bought
            owned = {product_type(b) for b in buys}
            price_kind = "gifts" if base == "gifts" else rng.choice([p for p in plain if p != base])
            options = [p for p in products[price_kind] if p not in buys and product_type(p) not in owned]
            if options:
                suggest = rng.choice(options)
            else:
                reason, price_kind = "best seller", kind
        if rng.random() < 0.05:  # no product history: nothing to anchor a suggestion on
            buys = []
            if because:
                reason, because = "best seller", None
        if rng.random() < 0.08:
            suggest = None
        cur, amount = synth_price(price_kind, rng)
        orders, days, gap = habit_numbers(seg, rng)
        rows.append(facts(seg, tone, name, shop, buys, orders, days, gap, suggest, because, reason, cur, amount, rng))
    return rows


JUNK = re.compile(r"postage|carriage|manual|discount|bank charges|amazon|samples|adjust|\?|dotcom|cruk|fee", re.I)


def uci_customers():
    """Real customers of the UCI Online Retail file, described and given a suggestion the way the app does it."""
    invoices, prod_lines, unit_prices, buyers = defaultdict(dict), defaultdict(Counter), defaultdict(list), defaultdict(set)
    last_bought = defaultdict(dict)
    with open(UCI, encoding="latin-1") as fh:
        for r in csv.DictReader(fh):
            cid, inv = r["CustomerID"].strip(), r["InvoiceNo"].strip()
            if not cid or inv.startswith("C") or float(r["Quantity"] or 0) <= 0 or float(r["UnitPrice"] or 0) <= 0:
                continue
            when = datetime.strptime(r["InvoiceDate"], "%m/%d/%Y %H:%M")
            invoices[cid][inv] = when
            desc = (r["Description"] or "").strip()
            if desc and not JUNK.search(desc):
                prod = tidy_product(desc)
                prod_lines[cid][prod] += 1
                unit_prices[prod].append(float(r["UnitPrice"]))
                buyers[prod].add(cid)
                if when > last_bought[cid].get(prod, datetime.min):
                    last_bought[cid][prod] = when
    end = max(max(v.values()) for v in invoices.values())
    best = [p for p, _ in sorted(buyers.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:60]]
    rank = {p: i for i, p in enumerate(best)}
    price_of = {p: sorted(unit_prices[p])[len(unit_prices[p]) // 2] for p in best}
    ptype = {p: product_type(p) for p in buyers}
    co = defaultdict(Counter)  # product -> best seller -> customers who bought both
    for prods in last_bought.values():
        mine = [b for b in prods if b in rank]
        for a in prods:
            for b in mine:
                if a != b:
                    co[a][b] += 1
    out = []
    for cid, invs in invoices.items():
        dates = sorted(invs.values())
        orders = len(dates)
        recency = (end.date() - dates[-1].date()).days + 1
        tenure = (end.date() - dates[0].date()).days + 1
        gap = (dates[-1] - dates[0]).days / (orders - 1) if orders >= 2 else None
        if tenure <= 90 or orders <= 2:
            seg = "promising" if orders >= 2 else ("new" if tenure <= 90 else "once")
        elif recency <= 30 and orders >= 10:
            seg = "best"
        elif recency <= 90:
            seg = "regular"
        elif recency <= 180:
            seg = "slipping"
        else:
            seg = "inactive"
        suggest, because, reason = related_pick(cid, last_bought[cid], end, best, rank, co, buyers, ptype)
        out.append({"seg": seg, "orders": orders, "recency": recency, "gap": gap,
                    "top": [p for p, _ in prod_lines[cid].most_common(3)],
                    "suggest": suggest, "because": because, "reason": reason,
                    "amount": price_of[suggest] if suggest else None})
    return out


def related_pick(cid, mine, end, best, rank, co, buyers, ptype):
    """The app's rule (src/rfm/recommendationEngine.ts pickRelated): what customers with the same products bought,
    weighted towards this customer's recent purchases, preferring their usual product type; every fourth customer
    gets a best seller of another type."""
    if not mine:
        return None, None, "-"
    weight = {a: 0.5 ** ((end - t).days / 90) for a, t in mine.items()}
    types = Counter()
    for a, w in weight.items():
        types[ptype[a]] += w
    usual = max(types, key=lambda t: (types[t], t))
    score, anchor = Counter(), {}
    for a, w in weight.items():
        for b, n in co[a].items():
            if b in mine:
                continue
            s = w * n / math.sqrt(len(buyers[a]) * len(buyers[b]))
            score[b] += s
            if n >= 2 and s > anchor.get(b, (0, None))[0]:
                anchor[b] = (s, a)
    open_ = [b for b in best if b not in mine]
    if not open_:
        return None, None, "-"
    if zlib.crc32(cid.encode()) % 4 == 0 and usual != "other":
        others = [b for b in open_ if ptype[b] != usual]
        if others:
            return max(others, key=lambda b: (score[b], -rank[b])), None, "something new"
    together = [b for b in open_ if b in anchor]
    if together:
        b = max(together, key=lambda b: (score[b] * (1.5 if ptype[b] == usual else 1), -rank[b]))
        return b, anchor[b][1], "bought together"
    same = [b for b in open_ if ptype[b] == usual and usual != "other"]
    if same:
        b = min(same, key=lambda b: rank[b])
        recent = max((a for a in mine if ptype[a] == usual), key=lambda a: mine[a])
        return b, recent, "same kind"
    return open_[0], None, "best seller"


def uci_rows(customers, names, shops, rng, banned=frozenset()):
    rows = []
    for c in customers:
        top = [p for p in c["top"] if p not in banned]
        ok = c["suggest"] and c["suggest"] not in banned and c["because"] not in banned
        name = rng.choice(names) if rng.random() < 0.75 else "-"
        rows.append(facts(c["seg"], rng.choice(TONES), name, rng.choice(shops), top, c["orders"], c["recency"], c["gap"],
                          c["suggest"] if ok else None, c["because"], c["reason"], "£", c["amount"] or 0, rng))
    return rows


def records(rows, rng):
    for f in rows:
        yield {"input": to_input(f), "target": write_message(f, rng), "facts": f}


def main():
    rng = random.Random(2026)
    OUT.mkdir(parents=True, exist_ok=True)
    products = {k: [tidy_product(p) for p in v.replace("\n", "").split("|") if p.strip()] for k, v in PRODUCTS.items()}
    names_tr, names_te = split(BD_NAMES + INTL_NAMES, rng)
    shops = {k: [f"{a} {w}" for a in (SHOP_PREFIX_INTL if k == "gifts" else SHOP_PREFIX_BD) for w in ws]
             for k, ws in SHOP_WORDS.items()}
    shops_tr, shops_te, prod_tr, prod_te = {}, {}, {}, {}
    for k, v in shops.items():
        shops_tr[k], shops_te[k] = split(v, rng)
    for k, v in products.items():
        prod_tr[k], prod_te[k] = split(v, rng)
    for k in MARKET:
        prod_tr[f"m_{k}"], prod_te[f"m_{k}"] = split({market_title(k, rng) for _ in range(1500)}, rng)
        shops_tr[f"m_{k}"], shops_te[f"m_{k}"] = shops_tr[k], shops_te[k]

    uci = uci_customers()
    rng.shuffle(uci)
    cut = int(len(uci) * 0.85)
    uci_tr, uci_te = uci[:cut], uci[cut:]
    prod_tr["gifts"], prod_te["gifts"] = split({p for c in uci for p in c["top"]}, rng)

    train = list(records(synth_customers(10000, rng, names_tr, shops_tr, prod_tr), rng))
    train += list(records(uci_rows(uci_tr, names_tr, shops_tr["gifts"], rng, banned=frozenset(prod_te["gifts"])), rng))
    rng.shuffle(train)
    val, train = train[:400], train[400:]
    test_synth = list(records(synth_customers(600, rng, names_te, shops_te, prod_te), rng))
    test_uci = list(records(uci_rows(uci_te, names_te, shops_te["gifts"], rng), rng))
    bad = [(r, p) for rows in (train, val, test_synth, test_uci) for r in rows for p in [self_check(r["facts"], r["target"])] if p]
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
    print("types (train):", Counter(r["facts"]["type"] for r in train))
    for r in train[:10]:
        print("\nIN :", r["input"], "\nOUT:", r["target"])


if __name__ == "__main__":
    main()
