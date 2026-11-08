"""Demo/seed data for the support desk — fictional, deterministic, offline.

Seeds agents, customers, tags and tickets with a spread of statuses,
priorities, tags and assignments, then runs the AI analysis + suggested-reply
flow (mock provider) on a few tickets. Everything is fictional; nothing calls
the real API.

Two datasets are bundled: English (default) and Chinese, so the demo — and the
README screenshots — can match the UI language. Both have identical shapes and
identical counts; only the human-readable strings differ.

Usage:
    python -m src.desk.seed                       # seed data/triagedesk.db (English)
    python -m src.desk.seed --lang zh             # Chinese demo content
    python -m src.desk.seed --db path/to/db.sqlite
    python -m src.desk.seed --reset               # wipe desk tables, then seed
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from src.desk.auth import AgentContext
from src.desk.models import TicketMessage, new_id
from src.desk.service import DeskConflict, DeskService
from src.desk.storage import DeskStore
from src.llm_client import MockLLMClient
from src.storage import utc_now_iso

ADMIN_EMAIL = "admin@triagedesk.example"


@dataclass(frozen=True)
class DemoTicket:
    """One fictional ticket, including the conversation depth used by the demo."""

    customer_email: str
    subject: str
    message: str
    priority: str
    tags: tuple[str, ...]
    assignee_email: str | None
    status: str
    agent_reply: str | None = None
    note: str | None = None


@dataclass(frozen=True)
class DemoDataset:
    admin_name: str
    agents: tuple[tuple[str, str], ...]        # (name, email)
    customers: tuple[tuple[str, str, str | None], ...]  # (name, email, external_id)
    tags: tuple[str, ...]
    tickets: tuple[DemoTicket, ...]
    analyze_subjects: frozenset[str]
    reply_subjects: frozenset[str]


EN = DemoDataset(
    admin_name="Dana Reyes",
    agents=(
        ("Maya Patel", "maya@triagedesk.example"),
        ("Omar Haddad", "omar@triagedesk.example"),
    ),
    customers=(
        ("Alice Johnson", "alice.johnson@example.com", None),
        ("Bob Miller", "bob.miller@example.com", "acme-1042"),
        ("Carla Gomez", "carla.gomez@example.com", None),
        ("Dan Wu", "dan.wu@example.com", "globex-77"),
    ),
    tags=("billing", "login", "onboarding", "urgent", "feedback", "feature-request"),
    tickets=(
        DemoTicket(
            "alice.johnson@example.com",
            "Cannot log in after password reset",
            "I cannot log into my account after resetting my password. The login page says "
            "my credentials are wrong even though I just reset them.",
            "high", ("login",), "maya@triagedesk.example", "open",
            agent_reply=(
                "Hi Alice, thanks for flagging this. The reset link was invalidated by a "
                "stale browser session — please try the reset again in a private window and "
                "let us know whether the new password works."
            ),
            note=(
                "Reproduced on staging: reset tokens issued before the cache purge are "
                "rejected. Engineering ticket OPS-241 is tracking the fix."
            ),
        ),
        DemoTicket(
            "bob.miller@example.com",
            "Charged twice for September invoice",
            "I was charged twice for my September invoice. Please refund the duplicate "
            "payment of $49.",
            "high", ("billing",), None, "open",
        ),
        DemoTicket(
            "carla.gomez@example.com",
            "Team locked out since this morning",
            "Our entire team has been locked out since this morning and we cannot process "
            "any orders. This is urgent, we are losing revenue every hour.",
            "urgent", ("login", "urgent"), "omar@triagedesk.example", "pending",
            note=(
                "Escalated to on-call. Account is on the legacy auth shard — check the "
                "failover log first."
            ),
        ),
        DemoTicket(
            "dan.wu@example.com",
            "Quote for enterprise plan",
            "Could you send me a quote for the Enterprise plan with 50 seats? We are "
            "evaluating vendors this month.",
            "normal", ("onboarding",), None, "open",
        ),
        DemoTicket(
            "alice.johnson@example.com",
            "Mobile app crashes on upload",
            "The mobile app crashes every time I try to upload a photo. It worked fine "
            "last week.",
            "normal", (), "maya@triagedesk.example", "resolved",
        ),
        DemoTicket(
            "bob.miller@example.com",
            "Feature idea: CSV export of tickets",
            "It would be great to export our tickets to CSV for our internal reporting. "
            "Keep up the great work, we love the product!",
            "low", ("feature-request", "feedback"), None, "closed",
        ),
        DemoTicket(
            "carla.gomez@example.com",
            "How do I add a new team member?",
            "How do I add a new team member to our workspace? I could not find the option "
            "in settings.",
            "low", ("onboarding",), None, "open",
        ),
        DemoTicket(
            "dan.wu@example.com",
            "Duplicate: charged twice for September",
            "I was charged twice for my September invoice. Please refund the duplicate "
            "payment of $49.",
            "high", (), None, "open",
        ),
    ),
    analyze_subjects=frozenset({
        "Cannot log in after password reset",
        "Team locked out since this morning",
        "Charged twice for September invoice",
    }),
    reply_subjects=frozenset({"Cannot log in after password reset"}),
)

ZH = DemoDataset(
    admin_name="陈静",
    agents=(
        ("李婷婷", "liting@triagedesk.example"),
        ("王浩", "wanghao@triagedesk.example"),
    ),
    customers=(
        ("赵敏", "zhao.min@example.com", None),
        ("孙立", "sun.li@example.com", "acme-1042"),
        ("周慧", "zhou.hui@example.com", None),
        ("吴丹", "wu.dan@example.com", "globex-77"),
    ),
    tags=("账单", "登录", "新手引导", "紧急", "反馈", "需求建议"),
    tickets=(
        DemoTicket(
            "zhao.min@example.com",
            "重置密码后仍然无法登录",
            "我重置密码之后仍然登录不进账号。登录页一直提示账号或密码错误，但我刚刚才重置过。",
            "high", ("登录",), "liting@triagedesk.example", "open",
            agent_reply=(
                "赵敏您好，感谢反馈。这次的重置链接已被一个过期的浏览器会话作废，请用无痕窗口重新"
                "重置一次，并告知新密码是否可以正常登录。"
            ),
            note="已在预发环境复现：缓存清理前签发的重置令牌会被拒绝。研发单 OPS-241 正在跟进。",
        ),
        DemoTicket(
            "sun.li@example.com",
            "九月账单被重复扣款",
            "我的九月账单被扣了两次款。请把重复扣掉的 49 元退回。",
            "high", ("账单",), None, "open",
        ),
        DemoTicket(
            "zhou.hui@example.com",
            "整个团队从今早开始被锁定",
            "我们整个团队从今天早上开始全部被锁定。现在无法下单，这个非常紧急，每小时都在损失收入。",
            "urgent", ("登录", "紧急"), "wanghao@triagedesk.example", "pending",
            note="已升级给值班同学。该账号在旧版认证集群上，先看故障切换日志。",
        ),
        DemoTicket(
            "wu.dan@example.com",
            "企业版报价咨询",
            "能否发一份 50 个席位的企业版报价？我们本月在做供应商选型。",
            "normal", ("新手引导",), None, "open",
        ),
        DemoTicket(
            "zhao.min@example.com",
            "移动端上传照片时崩溃",
            "移动端每次上传照片都会崩溃。上周还是正常的。",
            "normal", (), "liting@triagedesk.example", "resolved",
        ),
        DemoTicket(
            "sun.li@example.com",
            "需求建议：工单支持导出 CSV",
            "希望能把工单导出成 CSV 用于内部报表。产品很好用，继续保持！",
            "low", ("需求建议", "反馈"), None, "closed",
        ),
        DemoTicket(
            "zhou.hui@example.com",
            "如何添加新的团队成员？",
            "请问如何把新的团队成员加入工作区？我在设置里没有找到入口。",
            "low", ("新手引导",), None, "open",
        ),
        DemoTicket(
            "wu.dan@example.com",
            "重复提交：九月账单被重复扣款",
            "我的九月账单被扣了两次款。请把重复扣掉的 49 元退回。",
            "high", (), None, "open",
        ),
    ),
    analyze_subjects=frozenset({
        "重置密码后仍然无法登录",
        "整个团队从今早开始被锁定",
        "九月账单被重复扣款",
    }),
    reply_subjects=frozenset({"重置密码后仍然无法登录"}),
)

DATASETS = {"en": EN, "zh": ZH}


def seed_desk(db_path: str, *, reset: bool = False, lang: str = "en") -> dict:
    """Seed the desk; returns counts for CLI/CI verification. Fully offline."""
    dataset = DATASETS.get(lang)
    if dataset is None:
        raise ValueError(f"unknown demo language {lang!r}; expected one of {list(DATASETS)}")

    store = DeskStore(db_path)
    store.initialize()
    if reset:
        _wipe_desk_tables(store)

    llm = MockLLMClient()
    service = DeskService(store=store, llm_client=llm, provider="mock", model="mock-1")

    existing_agents = store.list_agents()
    if existing_agents:
        return {
            "skipped": True,
            "agents": len(existing_agents),
            "customers": store.count_customers(),
            "tickets": store.count_tickets(),
        }

    admin, _ = store.insert_agent(
        name=dataset.admin_name, email=ADMIN_EMAIL, role="admin", active=True
    )
    agents = {
        email: store.insert_agent(name=name, email=email, role="agent", active=True)[0]
        for name, email in dataset.agents
    }
    customers = {
        email: store.insert_customer(name=name, email=email, external_id=external)[0]
        for name, email, external in dataset.customers
    }
    tags = {name: store.insert_tag(name)[0] for name in dataset.tags}

    admin_context = AgentContext(agent_id=admin.id, name=admin.name, role=admin.role)

    created_tickets = []
    for spec in dataset.tickets:
        customer = customers[spec.customer_email]
        try:
            ticket = service.create_ticket(
                admin_context, customer_id=customer.id, subject=spec.subject,
                message=spec.message, priority=spec.priority,
            )
        except DeskConflict:
            # seeded duplicate (content-identical) -> link tags/status to the original
            duplicate = store.find_duplicate_ticket(
                service._content_hash(customer.id, spec.message)  # noqa: SLF001 - seeding helper
            )
            if duplicate is not None:
                created_tickets.append(duplicate)
            continue
        created_tickets.append(ticket)

    notes_added = 0
    for ticket, spec in zip(created_tickets, dataset.tickets, strict=False):
        for tag_name in spec.tags:
            service.add_tag(admin_context, ticket.id, tag_id=tags[tag_name].id)
        if spec.assignee_email:
            service.assign_ticket(
                admin_context, ticket.id, assignee_id=agents[spec.assignee_email].id
            )
        if spec.status != "open":
            service.update_ticket(admin_context, ticket.id, status=spec.status)
        if spec.agent_reply:
            store.insert_message(
                TicketMessage(
                    id=new_id(), ticket_id=ticket.id, author_type="agent",
                    author_name=admin.name, body=spec.agent_reply,
                    content_hash=None, created_at=utc_now_iso(),
                )
            )
            store.insert_event(
                ticket_id=ticket.id, event_type="message_added",
                actor_id=admin.id, metadata={"demo": True},
            )
        if spec.note:
            service.add_note(admin_context, ticket.id, body=spec.note)
            notes_added += 1

    analyzed = 0
    for ticket in created_tickets:
        if ticket.subject in dataset.analyze_subjects:
            service.ai_analyze_ticket(admin_context, ticket.id)
            analyzed += 1
        if ticket.subject in dataset.reply_subjects:
            service.ai_suggest_reply(admin_context, ticket.id)

    _stagger_timestamps(store, created_tickets)

    return {
        "skipped": False,
        "lang": lang,
        "agents": 1 + len(agents),
        "customers": len(customers),
        "tags": len(tags),
        "tickets": len(created_tickets),
        "ai_analyzed": analyzed,
        "ai_replies": len(dataset.reply_subjects),
        "notes": notes_added,
    }


# Hours-ago offsets for the demo tickets, so the inbox shows a believable spread
# ("2 hours ago", "yesterday", …) instead of eight identical "just now" rows.
_TICKET_AGE_HOURS = (2, 26, 51, 5, 74, 96, 9, 31)


def _stagger_timestamps(store: DeskStore, tickets: list) -> None:
    """Backdate demo rows: tickets, their messages, notes and events.

    Everything is written in one transaction so the thread, the activity tab and
    the audit log stay internally consistent (a reply never predates its ticket).
    """
    now = datetime.now(UTC)

    def iso(moment: datetime) -> str:
        return moment.isoformat(timespec="milliseconds")

    with store._connections.connect() as connection:  # noqa: SLF001 - own manager
        for index, ticket in enumerate(tickets):
            created = now - timedelta(hours=_TICKET_AGE_HOURS[index % len(_TICKET_AGE_HOURS)])
            updated = created + timedelta(minutes=42)
            connection.execute(
                "UPDATE tickets SET created_at = ?, updated_at = ?,"
                " resolved_at = CASE WHEN resolved_at IS NULL THEN NULL ELSE ? END"
                " WHERE id = ?",
                (iso(created), iso(updated), iso(created + timedelta(hours=1)), ticket.id),
            )
            rows = connection.execute(
                "SELECT id FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at, id",
                (ticket.id,),
            ).fetchall()
            for offset, row in enumerate(rows):
                connection.execute(
                    "UPDATE ticket_messages SET created_at = ? WHERE id = ?",
                    (iso(created + timedelta(minutes=4 + offset * 11)), row["id"]),
                )
            rows = connection.execute(
                "SELECT id FROM internal_notes WHERE ticket_id = ? ORDER BY created_at, id",
                (ticket.id,),
            ).fetchall()
            for offset, row in enumerate(rows):
                connection.execute(
                    "UPDATE internal_notes SET created_at = ? WHERE id = ?",
                    (iso(created + timedelta(minutes=18 + offset * 6)), row["id"]),
                )
            rows = connection.execute(
                "SELECT id FROM ticket_events WHERE ticket_id = ? ORDER BY created_at, id",
                (ticket.id,),
            ).fetchall()
            for offset, row in enumerate(rows):
                connection.execute(
                    "UPDATE ticket_events SET created_at = ? WHERE id = ?",
                    (iso(created + timedelta(minutes=2 + offset * 5)), row["id"]),
                )

        # Keep the audit log in the same window as the tickets it describes.
        connection.execute(
            "UPDATE audit_log SET created_at = ?"
            " WHERE created_at > ?",
            (iso(now - timedelta(hours=1)), iso(now - timedelta(minutes=2))),
        )


def _wipe_desk_tables(store: DeskStore) -> None:

    with store._connections.connect() as connection:  # noqa: SLF001 - own manager
        for table in ("audit_log", "ticket_events", "ticket_tags", "internal_notes",
                      "ticket_messages", "tickets", "tags", "agents", "customers"):
            connection.execute(f"DELETE FROM {table}")  # noqa: S608 - fixed table list


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m src.desk.seed",
        description="Seed fictional demo data for the TriageDesk support desk (offline).",
    )
    parser.add_argument(
        "--db", default="data/triagedesk.db",
        help="SQLite database path (default: %(default)s)",
    )
    parser.add_argument(
        "--lang", choices=sorted(DATASETS), default="en",
        help="demo content language (default: %(default)s)",
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="delete existing desk rows before seeding (inquiries are kept)",
    )
    args = parser.parse_args(argv)

    result = seed_desk(args.db, reset=args.reset, lang=args.lang)
    if result.get("skipped"):
        print(f"desk already populated ({result['agents']} agents) - nothing to do; "
              f"use --reset to reseed")
        return 0
    print(
        f"seeded ({args.lang}): {result['agents']} agents, {result['customers']} customers, "
        f"{result['tags']} tags, {result['tickets']} tickets, {result['notes']} notes "
        f"({result['ai_analyzed']} AI-analyzed, {result['ai_replies']} AI drafts) -> {args.db}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
