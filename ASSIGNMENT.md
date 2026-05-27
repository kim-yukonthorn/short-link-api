# Assignment — Add `short_link` Intent to Existing AI Agent

> สำหรับน้อง — เวลา **3 วัน**

ต่อยอดจาก AI agent ที่น้องทำเสร็จแล้ว (ตอนนี้มี intent อย่าง RAG, Harry Potter, ฯลฯ) ให้ **เพิ่ม `short_link` intent ตัวใหม่** ที่อ่าน/เขียนข้อมูลกับ [`short-link-api`](https://github.com/kim-yukonthorn/short-link-api) เพื่อตอบคำถามภาษาธรรมชาติเกี่ยวกับ short links

---

## Goal

> **เพิ่ม intent ใหม่ 1 ตัวชื่อ `short_link`** ใน classifier เดิม โดยภายในมี **sub-action router** ที่แตกย่อยเป็น 5 actions (create/list/analytics/summary/top) ก่อนยิง HTTP ไป short-link-api แล้วสรุปกลับเป็นภาษาคน

```
                ┌─────────────────┐
user message ──►│ top classifier  │── rag ───────► (existing handler)
                │ (เดิมของน้อง)   │── harry_potter ► (existing handler)
                │                 │── short_link ─►┐
                └─────────────────┘                │
                                                   ▼
                                       ┌──────────────────────┐
                                       │ short_link router    │
                                       │ + entity extractor   │
                                       └──────────────────────┘
                                                   │
                       ┌──────────┬────────────────┼──────────┬──────────┐
                       ▼          ▼                ▼          ▼          ▼
                   create_link  list_links  get_analytics  summary  top_links
                       │          │                │          │          │
                       └──────────┴──────► HTTP to short-link-api ◄──────┘
                                                   │
                                                   ▼
                                      ┌──────────────────────┐
                                      │ response formatter   │
                                      │ (ภาษาคน)             │
                                      └──────────────────────┘
```

**สิ่งที่น้องเขียนใหม่**: เฉพาะส่วน `short_link router → 5 actions → API → formatter` 
**สิ่งที่ไม่ต้องแก้**: top classifier เดิม — แค่เพิ่ม `short_link` เข้าไปใน list ของ intent

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

## 5 Sub-actions inside `short_link`

เมื่อ top classifier ตัดสินว่า intent = `short_link` แล้ว ให้ **sub-router ภายใน** เลือก action ตามตารางนี้:

| Sub-action | API call | Entities to extract |
|---|---|---|
| `create` | `POST /links` | `destination` (URL, **required**), `slug?`, `title?`, `tags?` |
| `list` | `GET /links?...` | `tag?`, `status?` (`active`/`expired`), `search?`, `from?`, `to?`, `limit?` |
| `analytics` | `GET /links/:slug/analytics` | `slug` (**required**) |
| `summary` | `GET /stats/summary` | (no entities) |
| `top` | `GET /stats/top?metric=clicks&period=...&limit=...` | `period?` (`7d`/`30d`/`all`), `limit?` |

ถ้าจัด `short_link` แต่ไม่แมตช์ sub-action ไหนเลย → ตอบ "ไม่เข้าใจ ลองถามใหม่ได้ไหม" (อย่าให้ LLM เดามั่ว)

---

## Test cases — น้องต้องผ่านทั้ง 10 ข้อ

ทุก case คาดหวัง: top classifier ตอบ `intent = short_link` → sub-router ตอบ `action + entities` → ยิง API → reply ภาษาคน

### 1. Create — happy path
> "ช่วยสร้าง short link ของ https://www.anthropic.com ให้ tag ai หน่อย"

Expect:
- `intent`: `short_link`, `action`: `create`
- `entities`: `{ destination: "https://www.anthropic.com", tags: ["ai"] }`
- Reply tone: บอก slug ที่ได้ + short URL พร้อมใช้

### 2. List by tag — happy path
> "ลิงก์ที่ tag marketing มีอะไรบ้าง"

Expect:
- `intent`: `short_link`, `action`: `list`
- `entities`: `{ tag: "marketing" }`
- API: `GET /links?tag=marketing`
- Reply tone: สรุปจำนวน + ยกตัวอย่าง 3-5 ตัว (seed data มี 9 ลิงก์ tag นี้)

### 3. Analytics — happy path
> "ลิงก์ google มีคนคลิกกี่ครั้ง"

Expect:
- `intent`: `short_link`, `action`: `analytics`
- `entities`: `{ slug: "google" }`
- API: `GET /links/google/analytics`
- Reply tone: ตอบจำนวนคลิก + insight อย่างน้อย 1 อย่าง (device หรือ country)

### 4. Summary — happy path
> "สรุปภาพรวมลิงก์ให้หน่อย"

Expect:
- `intent`: `short_link`, `action`: `summary`
- API: `GET /stats/summary`
- Reply tone: สรุปเป็นย่อหน้าสั้น ไม่ใช่ดัมพ์ JSON

### 5. Top links — happy path
> "ลิงก์ไหน hot สุด 5 อันดับในเดือนนี้"

Expect:
- `intent`: `short_link`, `action`: `top`
- `entities`: `{ period: "30d", limit: 5 }`
- API: `GET /stats/top?period=30d&limit=5`
- Reply tone: ranked list

### 6. Tag filter — Thai/English mix
> "show me ลิงก์ tag dev"

Expect:
- `intent`: `short_link`, `action`: `list`
- `entities`: `{ tag: "dev" }`
- LLM ต้องไม่สับสนเพราะ message ปนภาษา

### 7. Time-relative — สัปดาห์นี้
> "ลิงก์ที่สร้างสัปดาห์นี้มีอะไรบ้าง"

Expect:
- `intent`: `short_link`, `action`: `list`
- `entities`: `{ from: <ISO date 7 days ago> }`
- **Tip**: อย่าให้ LLM คำนวณวันที่เอง — ส่ง `current_date` ไปใน system prompt และให้ LLM ตอบเป็น relative token (`"7d_ago"`) แล้วน้องคำนวณ ISO ใน code

### 8. Ambiguous slug
> "ลิงก์ promo มีคนคลิกกี่ครั้ง"

Expect:
- `intent`: `short_link`, `action`: `analytics`
- `entities`: `{ slug: "promo" }`
- ปัญหา: seed มีทั้ง `promo-q1`, `promo-q2` — `GET /links/promo/analytics` จะ 404
- Reply tone: ตอบว่าหาไม่เจอ + เสนอ slug ที่ใกล้เคียง (อาจ list ผ่าน `?search=promo` ก่อน)

### 9. Not `short_link` intent — top classifier reject
> "Harry Potter เล่มไหนเด็ดสุด"

Expect:
- `intent`: **`harry_potter`** (ไม่ใช่ `short_link`)
- short_link handler ของน้องไม่ถูกเรียกเลย
- ทดสอบว่าการเพิ่ม `short_link` ไม่ไปกินทรัพยากร intent อื่น

### 10. Error — slug ไม่มีจริง
> "ลิงก์ xyz123abc มีคนคลิกกี่ครั้ง"

Expect:
- `intent`: `short_link`, `action`: `analytics`
- `entities`: `{ slug: "xyz123abc" }`
- API ตอบ 404: `{"message":"Link \"xyz123abc\" not found"}`
- Reply tone: แจ้ง user ว่าไม่เจอลิงก์นี้ ไม่ใช่ดัมพ์ stack trace

---

## Tips

1. **Match the pattern ของ project เดิม** — ถ้า classifier เดิมใช้ tool use ก็ใช้ tool use, ถ้าใช้ JSON output ก็ใช้ JSON อย่าง consistent ใน intent ใหม่ด้วย
2. **อย่ารบกวน top classifier เดิม** — แค่เพิ่ม `short_link` เข้าไปใน enum ของ intent + คำอธิบายสั้นๆ ว่าทำอะไร อย่าแก้ logic / prompt ของ RAG, Harry Potter ที่มีอยู่
3. **Sub-router แยกชั้น** — ภายใน `short_link` handler ให้เรียก LLM อีกครั้ง (หรือใช้ classifier ขนาดเล็ก) เพื่อเลือก action — อย่ายัด 5 action ไปอยู่ใน top classifier เลย จะทำให้ top แม่นน้อยลง
4. **Date math in code, not in LLM** — ส่ง `current_date` ไปใน prompt และให้ LLM ตอบ relative tokens (`today`, `this_week`, `7d_ago`) แล้วน้องแปลงเป็น ISO ใน code
5. **Validate LLM output before API call** — มี JSON schema ที่ตรวจ action + entities ก่อน fire HTTP request ถ้าผิด schema → retry หรือ fallback
6. **Test the API first** — เปิด Swagger UI หรือใช้ [`requests.http`](./requests.http) ทดลองทุก endpoint ก่อนต่อ LLM แยก failure mode ระหว่าง "API พัง" vs "LLM พัง"
7. **Keep replies short** — formatter พังง่ายถ้าให้สรุป JSON 50 fields ตัด `clicksByDay` ออกก่อนส่งให้ formatter ถ้าไม่ได้ถาม

---

## Deliverable

- **PR** ไปยัง AI agent repo เดิมของน้อง (ไม่ต้องสร้าง repo ใหม่ — แค่เพิ่ม intent)
- **PR description** = brief ตัวนี้ทั้งหมด (copy ลงไปได้เลย)
- ใน PR ต้องมี:
  - Code ของ `short_link` handler + sub-router
  - README / docs update ที่อธิบาย intent ใหม่
  - Example transcripts อย่างน้อย 3 ตัว (screenshot หรือ markdown block)
  - Note ว่าใช้ `short-link-api` ตัวไหน (Render URL)

### เกณฑ์การให้คะแนน

| Item | Weight |
|---|---|
| 10 test cases ทำงานถูก | 50% |
| ไม่กระทบ intent เดิม (RAG, Harry Potter, ฯลฯ ยังทำงานเหมือนเดิม) | 20% |
| Code/prompt อ่านง่าย + match style ของ project เดิม | 15% |
| Error handling (404, schema mismatch, ambiguous slug) | 15% |

---

## คำถาม / ติดขัด

- Issue ใน short-link-api → เปิด issue ที่ [github.com/kim-yukonthorn/short-link-api/issues](https://github.com/kim-yukonthorn/short-link-api/issues)
- คำถาม assignment → ทักพี่ตรงๆ
