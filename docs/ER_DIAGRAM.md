# KroyPulse data model (ER diagram)

KroyPulse has no server and no database. Everything below lives in the browser: accounts and the session in
`localStorage` / `sessionStorage`, and the shop's orders, customers, groups, suggestions, predictions and messages in
memory while the app is open. The diagram shows how these records relate, with the field names used in the code.

```mermaid
erDiagram
    USER_ACCOUNT ||--o| SESSION : "signs in with"
    USER_ACCOUNT ||--o{ DATASET : "opens"
    DATASET ||--|{ ORDER_LINE : "contains"
    CUSTOMER ||--|{ ORDER_LINE : "places"
    PRODUCT ||--o{ ORDER_LINE : "appears in"
    SEGMENT ||--o{ CUSTOMER : "groups"
    SEGMENT ||--|| CAMPAIGN_OFFER : "has"
    CUSTOMER ||--o| RECOMMENDATION : "is offered"
    PRODUCT ||--o{ RECOMMENDATION : "is suggested in"
    PRODUCT |o--o{ RECOMMENDATION : "is the basis of"
    CUSTOMER ||--o| PREDICTION : "has"
    CUSTOMER ||--o{ MESSAGE : "receives"
    CAMPAIGN_OFFER ||--o{ MESSAGE : "is sent in"
    RECOMMENDATION ||--o{ MESSAGE : "is pitched in"

    USER_ACCOUNT {
        string username PK
        string salt "PBKDF2, 16 bytes"
        string hash "PBKDF2-SHA-256"
        int iterations "600000"
        string createdAt
        bool test "the removable test account"
    }
    SESSION {
        string username FK
        int expiresAt "8 h; locks after 30 min idle"
    }
    DATASET {
        string name PK
        int rows "max 600000"
        string source "upload, sample or shop ledger"
    }
    ORDER_LINE {
        string orderId
        date timestamp
        string unifiedKey FK "customer"
        string sku FK "product"
        string productName
        float quantity
        float unitPrice
        float totalAmount
        bool isGuest
        string orderChannel "WhatsApp or Messenger"
    }
    CUSTOMER {
        string customerKey PK "phone, e-mail or ID (guest stitching)"
        string customerName
        string phone
        string email
        int recency "R, days"
        int frequency "F, orders"
        float monetary "M, total spend"
        float interPurchaseTime "T, days"
        int basketDepth "D, distinct products"
        string lifecycleStage "Early-Stage or Established"
        string persona FK "segment"
        string earlySegment "new-customer track"
    }
    SEGMENT {
        string persona PK "Champions, Regulars, At-Risk, Hibernating"
        int clusterIndex "K-Means, k = 4"
        int customerCount
        float revenueSharePct
        json zScores "centroid"
    }
    CAMPAIGN_OFFER {
        string persona PK, FK
        string discountCode
        string discountValue
        string messageTemplate
    }
    PRODUCT {
        string sku PK
        string name
        string type "electronics, beauty, ..."
        float price
        float popularity "share of buyers"
    }
    RECOMMENDATION {
        string customerKey FK
        string sku FK "suggested product"
        string basisProduct FK "their product it comes from"
        string suggestionKind "bought together, same kind, best seller, something new"
        float originalPrice
        float discountedPrice
    }
    PREDICTION {
        string customerKey FK
        float pActive "BG/NBD"
        float expectedOrders "next 30, 90 or 180 days"
        float expectedValue "Gamma-Gamma"
        float predictedSpend
    }
    MESSAGE {
        string customerKey FK
        string persona FK
        string channel "WhatsApp, Messenger or e-mail"
        string language "English or Bangla"
        string text
        string writtenBy "AI writer or template"
        bool factChecked
    }
```

## How a record flows

1. The owner signs in (**USER_ACCOUNT**, **SESSION**) and opens an order file (**DATASET**).
2. The cleaner turns each row into an **ORDER_LINE**; guest orders from the same phone number become one **CUSTOMER**.
3. Each customer gets five Extended RFM features and a **SEGMENT** (K-Means, k = 4), or a new-customer group.
4. Each segment has one **CAMPAIGN_OFFER**; each customer gets a **RECOMMENDATION** (a **PRODUCT** chosen from what
   buyers of their products bought) and a **PREDICTION** (chance still active, expected orders and spend).
5. A **MESSAGE** combines the customer, their offer and their suggestion; the AI writer's draft is used only if it
   passes the fact check, otherwise the template is.
