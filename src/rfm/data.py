import re
from typing import Dict, Any, Tuple, Optional, List
import pandas as pd
import numpy as np

def normalize_phone(val: Any) -> Optional[str]:
    """
    Normalizes phone numbers, stripping +880, 00880, 880, spaces, and punctuation.
    """
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ('nan', 'none', 'null'):
        return None
    digits = re.sub(r'[^\d+]', '', s)
    if digits.startswith('+880'):
        digits = '0' + digits[4:]
    elif digits.startswith('00880'):
        digits = '0' + digits[5:]
    elif digits.startswith('880'):
        digits = '0' + digits[3:]
    elif digits.startswith('+'):
        digits = digits[1:]
    return digits if len(digits) >= 7 else None

def normalize_email(val: Any) -> Optional[str]:
    """
    Normalizes and lowercases email address.
    """
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip().lower()
    if not s or '@' not in s or s in ('nan', 'none', 'null'):
        return None
    return s

def stitch_guest_identities(
    df: pd.DataFrame,
    customer_col: Optional[str] = None,
    phone_col: Optional[str] = None,
    email_col: Optional[str] = None,
    order_id_col: str = 'order_id'
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Stitches guest and registered user records using priority:
    CustomerID -> Normalized Phone -> Normalized Email -> guest_order_{order_id}
    """
    df = df.copy()
    
    # Clean phone and email
    if phone_col and phone_col in df.columns:
        df['norm_phone'] = df[phone_col].apply(normalize_phone)
    else:
        df['norm_phone'] = None

    if email_col and email_col in df.columns:
        df['norm_email'] = df[email_col].apply(normalize_email)
    else:
        df['norm_email'] = None

    if customer_col and customer_col in df.columns:
        df['clean_cust_id'] = df[customer_col].astype(str).replace(['nan', 'None', '', 'NaN'], np.nan)
    else:
        df['clean_cust_id'] = np.nan

    def build_key(row):
        if pd.notna(row['clean_cust_id']) and str(row['clean_cust_id']).strip():
            return f"cust_{str(row['clean_cust_id']).strip()}", False
        elif pd.notna(row['norm_phone']):
            return f"phone_{row['norm_phone']}", True
        elif pd.notna(row['norm_email']):
            return f"email_{row['norm_email']}", True
        else:
            return f"guest_order_{str(row[order_id_col])}", True

    keys_and_guest = df.apply(build_key, axis=1)
    df['Unified_Customer_Key'] = [k[0] for k in keys_and_guest]
    df['Is_Guest'] = [k[1] for k in keys_and_guest]

    # Metrics
    total_rows = len(df)
    unique_custs = df['Unified_Customer_Key'].nunique()
    guest_keys = set(df[df['Is_Guest']]['Unified_Customer_Key'])
    
    # Count repeat guest buyers
    guest_order_counts = df[df['Is_Guest']].groupby('Unified_Customer_Key')[order_id_col].nunique()
    repeat_guests_recovered = int((guest_order_counts >= 2).sum())

    stats = {
        'total_rows': total_rows,
        'unique_customers': unique_custs,
        'guest_customers': len(guest_keys),
        'repeat_guests_recovered': repeat_guests_recovered,
        'guest_share_pct': (len(guest_keys) / unique_custs * 100) if unique_custs > 0 else 0.0
    }

    return df, stats
