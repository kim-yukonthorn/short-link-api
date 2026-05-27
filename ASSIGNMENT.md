# Assignment — Intent Classifier for Short Link API

> สำหรับน้อง — เวลา **3 วัน**

ต่อยอดจาก AI agent ที่น้องทำเสร็จแล้ว ให้ **เพิ่ม intent ใหม่** ที่อ่านข้อมูลจาก [`short-link-api`](https://github.com/kim-yukonthorn/short-link-api) เพื่อตอบคำถามภาษาธรรมชาติเกี่ยวกับ short links ของ user

---

## Goal

> **Build a chat endpoint** that takes a natural-language message, classifies the user's intent, calls the right `short-link-api` endpoint, and replies in natural language.

```
┌────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ user msg   │ ──► │ intent classifier│ ──► │  call short-link │ ──► │ format reply    │
│ (ภาษาคน)   │     │ + entity extract │     │  -api endpoint   │     │ (ภาษาคน)        │
└────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
                          │ LLM                      │ HTTP                    │ LLM
                          │ tool use                 │ fetch/axios             │ summarize
```

---

## Setup

**API base URL**: ใส่ URL ที่ deploy บน Render (พี่จะส่งให้แยก — `https://short-link-api-XXXX.onrender.com`)
**Swagger UI**: `<base>/api/docs` — ดู schema ของทุก endpoint ที่นี่
**Auth**: ไม่ต้อง — API นี้ open

ถ้าอยาก run local:
```bash
git clone https://github.com/kim-yukonthorn/short-link-api.git
cd short-link-api && npm install
npm run db:migrate && npm run db:seed
npm run start:dev   # http://localhost:3000
```

> Render free tier sleep หลัง 15 นาที — request แรกหลัง sleep จะรอ ~30s ให้ตื่น คำขออื่นๆ จะเร็วปกติ

---

## Required intents (5)

น้องต้องรองรับ 5 intents ด้านล่างนี้ ทั้งหมดเป็น **read-only** (GET) ยกเว้น `create_link` ที่เป็น POST

| Intent | API call | Entities to extract |
|---|---|---|
| `create_link` | `POST /links` | `destination` (URL, **required**), `slug?`, `title?`, `tags?` |
| `list_links` | `GET /links?...` | `tag?`, `status?` (`active`/`expired`), `search?`, `from?`, `to?`, `limit?` |
| `get_link_analytics` | `GET /links/:slug/analytics` | `slug` (**required**) |
| `get_summary` | `GET /stats/summary` | (no entities) |
| `get_top_links` | `GET /stats/top?metric=clicks&period=...&limit=...` | `period?` (`7d`/`30d`/`all`), `limit?` |

ถ้า user message ไม่เข้ากับ intent ไหนเลย → ตอบว่า "ขอโทษครับ ทำได้แค่เรื่อง short link" (อย่าให้ LLM ตอบมั่ว)

---

## Test cases — น้องต้องผ่านทั้ง 10 ข้อ

ทุก case เริ่มจาก user message → classify → call API → reply ภาษาคน

### 1. Create — happy path
> "ช่วยสร้าง short link ของ https://www.anthropic.com ให้ tag ai หน่อย"

Expect:
- `intent`: `create_link`
- `entities`: `{ destination: "https://www.anthropic.com", tags: ["ai"] }`
- Reply tone: บอก slug ที่ได้ + short URL พร้อมใช้

### 2. List by tag — happy path
> "ลิงก์ที่ tag marketing มีอะไรบ้าง"

Expect:
- `intent`: `list_links`
- `entities`: `{ tag: "marketing" }`
- API: `GET /links?tag=marketing`
- Reply tone: สรุปจำนวน + ยกตัวอย่าง 3-5 ตัว (seed data มี 9 ลิงก์ tag นี้)

### 3. Analytics — happy path
> "ลิงก์ google มีคนคลิกกี่ครั้ง"

Expect:
- `intent`: `get_link_analytics`
- `entities`: `{ slug: "google" }`
- API: `GET /links/google/analytics`
- Reply tone: ตอบจำนวนคลิก + insight อย่างน้อย 1 อย่าง (device หรือ country)

### 4. Summary — happy path
> "สรุปภาพรวมให้หน่อย"

Expect:
- `intent`: `get_summary`
- API: `GET /stats/summary`
- Reply tone: สรุปเป็นย่อหน้าสั้น ไม่ใช่ดัมพ์ JSON

### 5. Top links — happy path
> "ลิงก์ไหน hot สุด 5 อันดับในเดือนนี้"

Expect:
- `intent`: `get_top_links`
- `entities`: `{ period: "30d", limit: 5 }`
- API: `GET /stats/top?period=30d&limit=5`
- Reply tone: ranked list

### 6. Tag filter — Thai/English mix
> "show me ลิงก์ tag dev"

Expect:
- `intent`: `list_links`
- `entities`: `{ tag: "dev" }`
- LLM ต้องไม่สับสนเพราะ message ปนภาษา

### 7. Time-relative — สัปดาห์นี้
> "ลิงก์ที่สร้างสัปดาห์นี้มีอะไรบ้าง"

Expect:
- `intent`: `list_links`
- `entities`: `{ from: <ISO date 7 days ago> }`
- **Tip**: อย่าให้ LLM คำนวณวันที่เอง — ส่ง `current_date` ไปใน system prompt และให้ LLM ตอบเป็น relative token (`"7d_ago"`) แล้วน้องคำนวณ ISO ใน code

### 8. Ambiguous slug
> "ลิงก์ promo มีคนคลิกกี่ครั้ง"

Expect:
- `intent`: `get_link_analytics`
- `entities`: `{ slug: "promo" }` หรือ ambiguous flag
- ปัญหา: seed มีทั้ง `promo-q1`, `promo-q2` — `GET /links/promo/analytics` จะ 404
- Reply tone: ตอบว่าหาไม่เจอ + เสนอ slug ที่ใกล้เคียง (อาจ list ผ่าน `?search=promo` ก่อน)

### 9. Out-of-scope
> "วันนี้อากาศเป็นยังไง"

Expect:
- ปฏิเสธ: "ขอโทษครับ ทำได้แค่เรื่อง short link"
- ห้ามเรียก API หรือเดาคำตอบ

### 10. Error — slug ไม่มีจริง
> "ลิงก์ xyz123abc มีคนคลิกกี่ครั้ง"

Expect:
- `intent`: `get_link_analytics`
- `entities`: `{ slug: "xyz123abc" }`
- API ตอบ 404: `{"message":"Link \"xyz123abc\" not found"}`
- Reply tone: แจ้ง user ว่าไม่เจอลิงก์นี้ ไม่ใช่ดัมพ์ stack trace

---

## Tips

1. **Tool use / function calling** — ใช้ structured output API (Claude tool use, OpenAI function calling) อย่า parse free-form text เด็ดขาด
2. **Enumerate intents in the system prompt** — list ทั้ง 5 intents ให้ LLM เห็น + ระบุ "if none match, return `intent: out_of_scope`"
3. **Date math in code, not in LLM** — ส่ง `current_date` ไปใน prompt และให้ LLM ตอบ relative tokens (`today`, `this_week`, `7d_ago`) แล้วน้องแปลงเป็น ISO ใน code
4. **Validate LLM output before API call** — มี JSON schema ที่ตรวจ intent + entities ก่อน fire HTTP request ถ้าผิด schema → retry หรือ fallback
5. **Test the API first** — เปิด Swagger UI หรือใช้ [`requests.http`](./requests.http) ทดลองทุก endpoint ก่อนต่อ LLM แยก failure mode ระหว่าง "API พัง" vs "LLM พัง"
6. **Keep replies short** — formatter LLM พังง่ายถ้าให้สรุป JSON 50 fields ตัด `clicksByDay` ออกก่อนส่งให้ formatter ถ้าไม่ได้ถาม

---

## Deliverable

- **Public GitHub repo** (ใหม่ — แยกจาก AI agent project เดิม)
- **README** มี:
  - Setup + run instructions
  - 2-3 example transcripts (screenshot หรือ markdown block)
  - Note ว่าใช้ `short-link-api` ตัวไหน (Render URL)
- **PR description** = brief ตัวนี้ทั้งหมด (copy ลงไปได้เลย)

### เกณฑ์การให้คะแนน

| Item | Weight |
|---|---|
| 10 test cases ทำงานถูก | 50% |
| Code อ่านง่าย, prompt ชัดเจน | 20% |
| Error handling (404, schema mismatch, out-of-scope) | 20% |
| README + example transcripts | 10% |

---

## คำถาม / ติดขัด

- Issue ใน short-link-api → เปิด issue ที่ [github.com/kim-yukonthorn/short-link-api/issues](https://github.com/kim-yukonthorn/short-link-api/issues)
- คำถาม assignment → ทักพี่ตรงๆ
