import io
import re
from typing import Dict, Any, Tuple, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_sample_whatsapp_shop_data() -> pd.DataFrame:
    """
    Generates a realistic Bangladeshi WhatsApp / POS Retail shop order dataset
    with local phone numbers (+8801...), guest checkouts, product names, and BDT prices.
    """
    products = [
        ('Pure Handloom Dhakai Jamdani Saree', 'JAM-DHK-01', 4850),
        ('Executive Silk Festive Panjabi (Royal Navy)', 'PAN-SLK-08', 2950),
        ('Tangail Organic Handspun Cotton Saree', 'TAN-COT-03', 2150),
        ('Sundarban Raw Wild Forest Honey (500g)', 'HNY-SND-500', 780),
        ('Handcrafted Nakshi Kantha Quilt (Queen)', 'NKH-QNT-02', 3450),
        ('Cold-Pressed Mustard Oil (Wood-churned 1L)', 'OIL-MST-1000', 420),
        ('Rajshahi Pure Silk Floral Dupatta', 'DUP-RJH-05', 1650),
    ]

    buyers = [
        ('Nusrat Jahan', '+8801711234567', 'nusrat.j@gmail.com', 'CUST-BD-01', 6, 2, 8),
        ('Tanvir Ahmed', '01819876543', 'tanvir.a@yahoo.com', '', 5, 3, 14),
        ('Farhana Sultana', '+8801914556677', 'farhana.s@hotmail.com', 'CUST-BD-03', 5, 2, 22),
        ('Sadia Rahman', '+8801612334455', '', '', 4, 1, 45),
        ('Mahmudul Hasan', '01755112233', 'mahmud.h@brac.net', '', 3, 2, 55),
        ('Kazi Moinuddin', '+8801733667788', 'kazi.moin@corp.bd', '', 2, 1, 110),
        ('Zubair Hossain', '+8801811443322', '', '', 1, 3, 80),
        ('Imtiaz Alam', '+8801977665544', 'imtiaz.alam@gmail.com', '', 1, 1, 240),
        ('Nasrin Parvin', '01833221100', '', '', 1, 1, 285),
    ]

    records = []
    base_date = datetime(2024, 10, 20)
    inv_num = 1001

    for name, phone, email, acc_id, orders, base_qty, recency in buyers:
        for o in range(orders):
            days_ago = recency + o * 32
            order_date = base_date - timedelta(days=days_ago)
            order_id = f"INV-BD-{inv_num}"
            inv_num += 1

            # 1 to 2 items per order
            p_idx = (o + len(name)) % len(products)
            prod_name, sku, unit_price = products[p_idx]
            qty = base_qty

            records.append({
                'order_id': order_id,
                'created_at': order_date.strftime('%Y-%m-%d %H:%M:%S'),
                'customer_name': name,
                'user_id': acc_id if acc_id else np.nan,
                'whatsapp_phone': phone,
                'customer_email': email,
                'product_name': prod_name,
                'sku': sku,
                'quantity': qty,
                'unit_price': unit_price,
                'total_price': qty * unit_price,
                'channel': 'WhatsApp Shop',
                'city': 'Dhaka'
            })

    return pd.DataFrame(records)

def detect_columns(columns: list) -> Dict[str, str]:
    """
    Fuzzy matches dataset columns to RFM standard slots
    """
    def match(keywords):
        for kw in keywords:
            for col in columns:
                clean_col = re.sub(r'[^a-zA-Z0-9]', '', str(col).lower())
                clean_kw = re.sub(r'[^a-zA-Z0-9]', '', kw.lower())
                if clean_kw in clean_col:
                    return col
        return ''

    return {
        'order_id': match(['invoiceno', 'invoice_no', 'orderid', 'order_id', 'receipt']),
        'timestamp': match(['invoicedate', 'invoice_date', 'orderdate', 'order_date', 'created_at', 'date']),
        'customer_id': match(['customerid', 'customer_id', 'userid', 'user_id', 'client_id']),
        'phone': match(['phone', 'whatsapp', 'mobile', 'cell', 'contact']),
        'email': match(['email', 'mail']),
        'product': match(['stockcode', 'sku', 'product_id', 'item_code', 'product_name', 'description']),
        'quantity': match(['quantity', 'qty', 'count']),
        'unit_price': match(['unitprice', 'unit_price', 'price', 'rate']),
        'total_amount': match(['totalamount', 'total_amount', 'total', 'amount', 'total_price']),
    }
