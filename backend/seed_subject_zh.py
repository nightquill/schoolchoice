"""Seed Chinese names (name_zh) for HKDSE subjects.

Official subject names from HKEAA (Hong Kong Examinations and Assessment Authority).

Usage:
    python seed_subject_zh.py
"""
from app.db.session import engine
from sqlalchemy import text


# Subject code -> Chinese name mapping (HKDSE)
SUBJECT_ZH = {
    # Core subjects
    "CHLA": "中國語文",
    "ENGL": "英國語文",
    "MATH": "數學（必修部分）",
    "CSD": "公民與社會發展",

    # Mathematics extended modules
    "M1": "數學延伸部分（單元一）",
    "M2": "數學延伸部分（單元二）",

    # Elective subjects — Sciences
    "PHYS": "物理",
    "CHEM": "化學",
    "BIOL": "生物",

    # Elective subjects — Business / Social Sciences
    "ECON": "經濟",
    "BAFS": "企業、會計與財務概論",
    "GEOG": "地理",
    "HIST": "歷史",
    "CHIH": "中國歷史",
    "TOUR": "旅遊與款待",

    # Elective subjects — Arts / Humanities
    "CHIL": "中國文學",
    "VART": "視覺藝術",
    "MUSC": "音樂",
    "ERS": "倫理與宗教",

    # Elective subjects — Technology
    "ICT": "資訊及通訊科技",
    "DAT": "設計與應用科技",
    "HMSC": "健康管理與社會關懷",
    "TL": "科技與生活",
    "PE": "體育",

    # Elective subjects — Combined / Integrated
    "CSCI": "組合科學",
    "ISCI": "綜合科學",

    # Other languages
    "FREN": "法語",
    "GERM": "德語",
    "JAPA": "日語",
    "SPAN": "西班牙語",
    "PTH": "普通話",
}


def main():
    with engine.connect() as conn:
        # 1. Add name_zh column if not exists (SQLite compat)
        from sqlalchemy import inspect
        insp = inspect(engine)
        cols = [c['name'] for c in insp.get_columns('subjects')]
        if 'name_zh' not in cols:
            conn.execute(text("ALTER TABLE subjects ADD COLUMN name_zh VARCHAR(255)"))
            conn.commit()

        # 2. Update each subject by code
        updated = 0
        skipped = 0
        for code, zh_name in SUBJECT_ZH.items():
            result = conn.execute(
                text("""
                    UPDATE subjects
                    SET name_zh = :zh_name, updated_at = CURRENT_TIMESTAMP
                    WHERE code = :code
                """),
                {"zh_name": zh_name, "code": code},
            )
            if result.rowcount > 0:
                updated += 1
            else:
                skipped += 1

        conn.commit()
        print(f"Done. Updated: {updated}, Not found in DB (skipped): {skipped}")
        print(f"Total Chinese names available: {len(SUBJECT_ZH)}")


if __name__ == "__main__":
    main()
