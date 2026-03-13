# Chat Participants Inspection Report

**Date:** March 12, 2025  
**Scope:** Verify all possible participants (admin, visitor, contractor, customer) can talk to each other via ProBot chat.

---

## Participant Roles

| Role | Description | Auth |
|------|-------------|------|
| **Visitor** | Anonymous user on the site (no account or not signed in) | Optional; identified by `visitorId` (client-generated, e.g. localStorage) |
| **Customer** | Signed-in user without a business (profile has no `business_id`) | Yes |
| **Contractor** | Signed-in user with a business (profile has `business_id`) | Yes |
| **Admin** | User whose email matches `ADMIN_EMAIL` (in `admin_users`) | Yes |

---

## Data Model (Summary)

- **probot_conversations**: One per `visitor_id` (one thread per visitor/customer/contractor session).
- **probot_messages**: `sender` is only `'visitor' | 'admin'`. Optional `business_id` indicates the message is to/from that business (contractor). Optional `admin_sent_as`: `'probot' | 'business' | 'hub_agent'` and `admin_user_id` for display.

---

## Send / Read Matrix

### 1. Visitor ↔ Admin / ProBot

| Direction | Send | Read | Notes |
|-----------|------|------|--------|
| Visitor → Admin/ProBot | ✅ | ✅ | `POST /api/chat/messages` (no `businessId`). Creates/uses conversation by `visitorId`. |
| Admin/ProBot → Visitor | ✅ | ✅ | `POST /api/chat/admin/messages` (admin only). `GET /api/chat/messages` with `visitorId` for visitor. |

**Verdict:** Fully supported.

---

### 2. Visitor / Customer ↔ Contractor (specific business)

| Direction | Send | Read | Notes |
|-----------|------|------|--------|
| Visitor/Customer → Contractor | ✅ | N/A | `POST /api/chat/messages` with `businessId` set to the business. Admin also gets notified. |
| Contractor → Visitor/Customer | ✅ | ✅ | Contractor replies via `POST /api/chat/admin/messages` with `sentAs: { businessId }` (forced by API when not admin). Contractor reads via `GET /api/chat/messages` (no `visitorId`; API uses their `business_id` and filters to conversations with messages for that business). |

**Verdict:** Fully supported. Contractor list comes from `GET /api/chat/contractor/conversations`; they open a conversation and reply as their business.

---

### 3. Admin ↔ Visitor / Customer

| Direction | Send | Read | Notes |
|-----------|------|------|--------|
| Admin → Visitor/Customer | ✅ | ✅ | `POST /api/chat/admin/messages` (as ProBot, Hub Agent, or as a business). Admin reads via `GET /api/chat/admin/conversations` and `GET /api/chat/messages` without `visitorId`. |

**Verdict:** Fully supported.

---

### 4. Admin ↔ Contractor (as “contact”)

Admin does not have a separate DM channel to contractors. Admin can:

- Reply **as** a specific business in a visitor/customer thread (`sentAs: { businessId }`), so the contractor sees that reply in their own chat view.
- See all businesses as contacts and all conversations (including contractor threads).

So: Admin talks to visitors/customers (and can impersonate a business); contractors see those business-scoped messages. There is no separate admin-to-contractor direct thread.

**Contractor → Admin:** Yes. Contractor selects ProBot and sends (visitor flow, no `businessId`); admin sees the thread in History Chat and replies as ProBot/Hub Agent.

**Admin → Contractor:** Partial. Admin cannot start a new “DM to this business” thread; admin can only reply inside existing threads (e.g. as that business in a visitor/customer thread).

**Why not full?** Every conversation is created only when a **visitor or contractor** sends a message or calls "create conversation." The table `probot_conversations` is keyed by `visitor_id` (one thread per visitor/session). There is no API or flow for **admin** to create a new conversation or send the first message to a business that has never messaged ProBot. So admin can only reply in threads that already exist.

**What would make it full?** (1) Allow admin to create a conversation for a business, e.g. with a convention like `visitor_id = hub-dm-{businessId}`. (2) Let admin send the first message in that thread (e.g. extend `POST /api/chat/admin/messages` or add an "admin start DM" endpoint). (3) Have contractor conversation list include these threads (e.g. conversations where `visitor_id = hub-dm-{theirBusinessId}` or a dedicated flag).

**Verdict:** Contractor → Admin DM is fully supported. Admin → Contractor is partial (reply in existing threads only).

---

### 5. Contractor ↔ ProBot (Admin)

| Direction | Send | Read | Notes |
|-----------|------|------|--------|
| Contractor → ProBot | ✅ | ✅ | Contractor uses the same visitor flow: same `visitorId`/conversation, `POST /api/chat/messages` with **no** `businessId`. Stored as `sender: 'visitor'`. |
| ProBot/Admin → Contractor | ✅ | ✅ | Admin replies via `POST /api/chat/admin/messages` as ProBot (or Hub Agent). Contractor sees messages when viewing ProBot contact (same conversation). |

**Verdict:** Fully supported. Contractor is treated as a visitor in the ProBot thread.

---

### 6. Contractor ↔ Contractor (Business A ↔ Business B)

| Direction | Send | Read | Notes |
|-----------|------|------|--------|
| Contractor A → Business B | ✅ | N/A | A selects B from contacts (other businesses). A sends via `POST /api/chat/messages` with `businessId: B` and same `visitorId`/conversation. Message stored as `sender: 'visitor'`, `business_id: B`. |
| Contractor B → Contractor A | ✅ | ✅ | B sees the conversation in `GET /api/chat/contractor/conversations` (has message with `business_id: B`). B replies via `POST /api/chat/admin/messages` with `sentAs: { businessId: B }`. A, when viewing B in the sidebar, loads the same conversation (by `visitorId`) and sees all messages, including B’s reply. |

**Verdict:** Fully supported. Same conversation keyed by A’s `visitor_id`; messages scoped by `business_id` so B only sees/replies in their scope.

---

### 7. Customer ↔ Customer

Customers (signed-in, no business) only have contacts: ProBot + all businesses. Other customers are not listed as contacts, and there is no flow to start a customer-to-customer thread.

**Verdict:** Not supported (and likely by design).

---

## API Endpoints Summary

| Endpoint | Who uses it | Purpose |
|----------|-------------|---------|
| `POST /api/chat/conversations` | Visitor, Customer, Contractor (as visitor) | Create or get conversation by `visitorId` (no auth required). |
| `POST /api/chat/messages` | Visitor, Customer, Contractor (when not in “admin view”) | Send as `visitor`; optional `businessId` to target a business. |
| `GET /api/chat/messages` | Visitor (with `visitorId`), Admin (no `visitorId`), Contractor (no `visitorId`; filtered by their `business_id`) | Read messages; contractor sees only messages for their business in that thread. |
| `POST /api/chat/admin/messages` | Admin, Contractor | Send as `admin` (ProBot, Hub Agent, or as business). Contractor only with `sentAs: { businessId }` and only in conversations that have a message for that business. |
| `GET /api/chat/admin/conversations` | Admin | List all conversations (and contractor can use contractor/conversations). |
| `GET /api/chat/contractor/conversations` | Contractor | List conversations that have at least one message with their `business_id`. |
| `GET /api/chat/contacts` | Admin, Contractor, Customer | List contacts (ProBot, businesses, customers per role). |
| `GET /api/chat/admin/conversations/[id]` | Admin, Contractor | Get one conversation; contractor only if conversation involves their business. |

---

## Findings

1. **Visitor, Customer, Admin, Contractor** can all participate in chat; messaging is consistent with the model (visitor vs admin senders, `business_id` for contractor targeting).
2. **Contractor can reply** only via the admin-messages endpoint (stored as `admin` with `business_id`); they cannot send as “visitor” in a thread they’re viewing as a business (by design).
3. **Contractor-to-contractor** works: one contractor sends as visitor with `businessId`, the other sees the thread and replies as their business.
4. **Customer-to-customer** is not implemented (no such contacts or flow).
5. **Contractor → Admin DM is supported** (contractor messages ProBot; admin replies). **Admin → Contractor** has no dedicated “new DM” flow; admin can only reply as that business in existing threads.

---

## Recommendations

- **No blocking issues** for the current participant set (admin, visitor, customer, contractor). All intended pairs can communicate.
- If **customer-to-customer** or **admin↔contractor DMs** are required later, they would need either a new conversation type (e.g. keyed by two user/business ids) or a clear convention reusing the current `visitor_id`/conversation model and contact list.
