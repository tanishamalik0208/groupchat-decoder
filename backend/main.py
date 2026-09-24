import os
import re
import json
from collections import Counter
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(
    title="GroupChat Decoder API",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# WORD GROUPS
# =========================================================

STOP_WORDS = {
    "the", "and", "that", "this", "with", "from", "have",
    "will", "your", "what", "when", "where", "which",
    "about", "there", "they", "them", "then", "just",
    "into", "for", "are", "was", "were", "you", "our",
    "but", "not", "can", "could", "should", "would",
    "has", "had", "been", "being", "its", "it's", "i",
    "we", "he", "she", "it", "to", "of", "in", "on",
    "is", "a", "an", "or", "as", "at", "be", "do", "did",
    "so", "if", "my", "me", "us", "all", "very", "really",
    "also", "than"
}

POSITIVE_WORDS = {
    "great", "good", "awesome", "amazing", "nice", "perfect",
    "love", "happy", "excited", "cool", "works", "done",
    "yes", "win", "winning", "success", "successful",
    "thanks", "thank", "excellent", "clear", "easy",
    "ready", "progress", "strong", "nice"
}

NEGATIVE_WORDS = {
    "bad", "problem", "issue", "wrong", "late", "delay",
    "stuck", "confused", "confusing", "difficult", "hard",
    "failed", "fail", "error", "worried", "stress",
    "stressed", "urgent", "missing", "cannot", "can't",
    "no", "never", "blocked", "broken", "risk"
}

TOPIC_GROUPS = {
    "Project": {
        "project", "app", "application", "build", "feature",
        "backend", "frontend", "code", "coding", "github",
        "repository", "repo", "api", "database"
    },
    "Design & UI": {
        "design", "ui", "ux", "screen", "page", "color",
        "layout", "button", "interface", "figma", "website",
        "visual", "responsive"
    },
    "Research": {
        "research", "data", "study", "paper", "analysis",
        "survey", "source", "sources", "information"
    },
    "Presentation": {
        "presentation", "slides", "slide", "ppt", "demo",
        "pitch", "explain", "speaker", "present"
    },
    "Deadlines": {
        "deadline", "due", "tomorrow", "today", "tonight",
        "friday", "monday", "saturday", "sunday", "submit",
        "submission", "thursday"
    },
    "Meetings": {
        "meeting", "meet", "call", "zoom", "discussion",
        "discuss", "schedule"
    },
    "College": {
        "college", "class", "assignment", "professor",
        "teacher", "exam", "semester", "btech", "lecture"
    },
    "Competition": {
        "competition", "hackathon", "contest", "judge",
        "judges", "team", "pitch"
    },
}

ACTION_PATTERNS = [
    "i will",
    "i'll",
    "i can",
    "i need to",
    "i have to",
    "need to",
    "we need to",
    "should",
    "please",
    "can you",
    "could you",
    "make sure",
    "finish",
    "send",
    "prepare",
    "submit",
    "bring",
    "handle",
    "review",
    "update",
    "create",
    "complete",
    "check",
    "book",
    "call",
    "meet",
    "upload",
    "add",
    "fix",
    "write",
    "research",
    "design",
    "test",
]

DECISION_PATTERNS = [
    "let's",
    "lets ",
    "we'll",
    "we will",
    "agreed",
    "confirmed",
    "decided",
    "decision",
    "go with",
    "use this",
    "works for me",
    "sounds good",
    "yes,",
    "okay,",
    "ok,",
    "settled",
    "final",
]

COLLABORATION_PATTERNS = [
    "together",
    "we",
    "team",
    "everyone",
    "let's",
    "lets",
    "help",
    "support",
    "agree",
    "agreed",
    "great",
    "thanks",
    "can you",
    "i can",
    "we need",
]

DEADLINE_WORDS = [
    "today",
    "tonight",
    "tomorrow",
    "morning",
    "afternoon",
    "evening",
    "friday",
    "saturday",
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "next week",
    "by ",
    "before ",
    "at ",
]


# =========================================================
# PARSING
# =========================================================

def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_messages(chat: str) -> list[dict[str, str]]:
    patterns = [
        re.compile(
            r"^(?:\[[^\]]+\]\s*)?"
            r"(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4},?\s+"
            r"\d{1,2}:\d{2}(?:\s*[APMapm]{2})?\s*-\s*)?"
            r"(?P<name>[^:]{1,60}):\s*(?P<text>.+)$"
        )
    ]

    messages = []
    current = None

    for raw_line in chat.splitlines():
        line = raw_line.strip()

        if not line:
            continue

        match = None

        for pattern in patterns:
            match = pattern.match(line)
            if match:
                break

        if match:
            name = clean_text(match.group("name"))
            text = clean_text(match.group("text"))

            if "messages and calls are end-to-end encrypted" in text.lower():
                continue

            current = {
                "name": name,
                "text": text
            }

            messages.append(current)

        elif current:
            current["text"] += " " + line

    if not messages:
        for index, line in enumerate(chat.splitlines(), start=1):
            line = clean_text(line)

            if line:
                messages.append({
                    "name": f"Person {index}",
                    "text": line
                })

    return messages


# =========================================================
# SENTIMENT
# =========================================================

def sentiment(messages):
    positive = 0
    negative = 0

    for message in messages:
        words = set(
            re.findall(
                r"[a-zA-Z']+",
                message["text"].lower()
            )
        )

        positive += len(words & POSITIVE_WORDS)
        negative += len(words & NEGATIVE_WORDS)

    total = positive + negative

    if total == 0:
        label = "Neutral"
        score = 50

    elif positive > negative * 1.5:
        label = "Positive"
        score = min(95, 65 + positive * 4)

    elif negative > positive * 1.5:
        label = "Concerned"
        score = max(20, 50 - negative * 5)

    else:
        label = "Balanced"
        score = 55

    explanations = {
        "Positive":
            "The group uses mostly constructive and encouraging language.",

        "Concerned":
            "Several messages contain urgency, uncertainty, or problem signals.",

        "Balanced":
            "The conversation combines progress with some concerns or open items.",

        "Neutral":
            "The discussion is mostly informational and task-focused."
    }

    return {
        "label": label,
        "score": score,
        "explanation": explanations[label]
    }


# =========================================================
# TOPICS
# =========================================================

def detect_topics(messages):
    combined = " ".join(
        message["text"].lower()
        for message in messages
    )

    topics = []

    for topic, keywords in TOPIC_GROUPS.items():
        mentions = 0

        for keyword in keywords:
            mentions += len(
                re.findall(
                    r"\b" + re.escape(keyword) + r"\b",
                    combined
                )
            )

        if mentions:
            topics.append({
                "name": topic,
                "mentions": mentions
            })

    topics.sort(
        key=lambda item: item["mentions"],
        reverse=True
    )

    if not topics:
        topics.append({
            "name": "General discussion",
            "mentions": len(messages)
        })

    return topics[:7]


# =========================================================
# DEADLINES
# =========================================================

def extract_deadline(text):
    lower = text.lower()

    patterns = [
        r"\b(today)\b",
        r"\b(tonight)\b",
        r"\b(tomorrow)\b",
        r"\b(monday)\b",
        r"\b(tuesday)\b",
        r"\b(wednesday)\b",
        r"\b(thursday)\b",
        r"\b(friday)\b",
        r"\b(saturday)\b",
        r"\b(sunday)\b",
        r"\b(next week)\b",
        r"\bby\s+([a-zA-Z0-9: ]{2,20})",
        r"\bbefore\s+([a-zA-Z0-9: ]{2,20})",
    ]

    for pattern in patterns:
        match = re.search(pattern, lower)

        if match:
            value = match.group(0).strip()
            return value.capitalize()

    return "Not specified"


# =========================================================
# ACTION ITEMS
# =========================================================

def clean_action(text):
    text = clean_text(text)

    prefixes = [
        "please ",
        "can you ",
        "could you ",
        "we need to ",
        "i need to ",
        "i will ",
        "i'll ",
    ]

    lowered = text.lower()

    for prefix in prefixes:
        if lowered.startswith(prefix):
            text = text[len(prefix):]
            break

    return text.rstrip(".!? ")


def extract_actions(messages):
    actions = []

    for message in messages:
        text = message["text"]
        lower = text.lower()

        is_action = any(
            pattern in lower
            for pattern in ACTION_PATTERNS
        )

        if not is_action:
            continue

        if (
            text.strip().endswith("?")
            and not any(
                word in lower
                for word in [
                    "send",
                    "prepare",
                    "submit",
                    "create",
                    "fix",
                    "update",
                    "finish"
                ]
            )
        ):
            continue

        actions.append({
            "assignee": message["name"],
            "task": clean_action(text),
            "deadline": extract_deadline(text),
            "status": "Open"
        })

    unique = []
    seen = set()

    for action in actions:
        key = (
            action["assignee"].lower(),
            action["task"].lower()
        )

        if key not in seen:
            seen.add(key)
            unique.append(action)

    return unique[:12]


# =========================================================
# PEOPLE
# =========================================================

def infer_role(texts):
    combined = " ".join(texts).lower()

    roles = {
        "Developer": [
            "code", "coding", "backend", "frontend",
            "api", "github", "bug", "fix", "python",
            "react", "javascript", "database"
        ],

        "Designer": [
            "design", "ui", "ux", "figma", "color",
            "layout", "screen", "visual", "responsive"
        ],

        "Researcher": [
            "research", "data", "source", "paper",
            "survey", "analysis", "study"
        ],

        "Presenter": [
            "presentation", "slides", "ppt", "demo",
            "present", "pitch"
        ],

        "Coordinator": [
            "meeting", "deadline", "schedule",
            "team", "everyone", "organize", "remind"
        ]
    }

    scores = {}

    for role, words in roles.items():
        scores[role] = sum(
            combined.count(word)
            for word in words
        )

    if not scores:
        return "General contributor"

    best = max(
        scores,
        key=scores.get
    )

    if scores[best] == 0:
        return "General contributor"

    return best


def extract_people(messages):
    grouped = {}

    for message in messages:
        grouped.setdefault(
            message["name"],
            []
        ).append(message["text"])

    total_messages = max(len(messages), 1)

    people = []

    for name, texts in grouped.items():
        count = len(texts)

        people.append({
            "name": name,
            "role": infer_role(texts),
            "messages": count,
            "share": round(
                (count / total_messages) * 100
            )
        })

    people.sort(
        key=lambda person: person["messages"],
        reverse=True
    )

    return people[:12]


# =========================================================
# DECISIONS
# =========================================================

def extract_decisions(messages):
    decisions = []

    for message in messages:
        lower = message["text"].lower()

        if any(
            pattern in lower
            for pattern in DECISION_PATTERNS
        ):
            decisions.append(
                f"{message['name']}: {message['text']}"
            )

    return list(
        dict.fromkeys(decisions)
    )[:10]


# =========================================================
# QUESTIONS
# =========================================================

def extract_questions(messages):
    questions = []

    for message in messages:
        text = message["text"].strip()

        if text.endswith("?"):
            questions.append(
                f"{message['name']}: {text}"
            )

    return list(
        dict.fromkeys(questions)
    )[:10]


# =========================================================
# KEY MESSAGES
# =========================================================

def extract_key_messages(messages):
    scored = []

    for index, message in enumerate(messages):
        text = message["text"]
        lower = text.lower()

        score = 0

        if "?" in text:
            score += 2

        if any(
            word in lower
            for word in ACTION_PATTERNS
        ):
            score += 3

        if any(
            word in lower
            for word in DECISION_PATTERNS
        ):
            score += 3

        if extract_deadline(text) != "Not specified":
            score += 2

        if len(text) > 80:
            score += 1

        scored.append(
            (
                score,
                index,
                f"{message['name']}: {text}"
            )
        )

    scored.sort(
        reverse=True
    )

    return [
        item[2]
        for item in scored[:8]
        if item[0] > 0
    ]


# =========================================================
# COLLABORATION
# =========================================================

def collaboration_analysis(messages):
    if not messages:
        return {
            "score": 0,
            "label": "Unknown",
            "description": "Not enough data."
        }

    collaboration_hits = 0

    for message in messages:
        lower = message["text"].lower()

        if any(
            pattern in lower
            for pattern in COLLABORATION_PATTERNS
        ):
            collaboration_hits += 1

    score = round(
        (collaboration_hits / len(messages)) * 100
    )

    if score >= 65:
        label = "Highly collaborative"
    elif score >= 40:
        label = "Collaborative"
    elif score >= 20:
        label = "Mixed"
    else:
        label = "Mostly individual"

    descriptions = {
        "Highly collaborative":
            "The conversation contains frequent coordination, agreement and shared ownership.",

        "Collaborative":
            "Participants regularly coordinate tasks and respond to one another.",

        "Mixed":
            "The conversation contains collaboration, but also several independent updates.",

        "Mostly individual":
            "Most messages appear to be individual updates rather than collaborative discussion."
    }

    return {
        "score": score,
        "label": label,
        "description": descriptions[label]
    }


# =========================================================
# CONVERSATION HEALTH
# =========================================================

def conversation_health(
    messages,
    actions,
    decisions,
    questions,
    collaboration
):
    if not messages:
        return {
            "score": 0,
            "label": "Unknown"
        }

    score = 55

    if collaboration["score"] >= 60:
        score += 15

    elif collaboration["score"] >= 35:
        score += 8

    if decisions:
        score += min(15, len(decisions) * 3)

    if actions:
        score += min(10, len(actions) * 2)

    if len(questions) > len(decisions) + 2:
        score -= 10

    score = max(
        0,
        min(100, score)
    )

    if score >= 80:
        label = "Strong"
    elif score >= 65:
        label = "Healthy"
    elif score >= 45:
        label = "Needs clarity"
    else:
        label = "At risk"

    return {
        "score": score,
        "label": label
    }


# =========================================================
# RISK SIGNALS
# =========================================================

def risk_signals(messages, actions, questions):
    risks = []

    urgent_words = [
        "urgent",
        "late",
        "delay",
        "stuck",
        "blocked",
        "missing",
        "problem",
        "issue",
        "deadline"
    ]

    for message in messages:
        lower = message["text"].lower()

        hits = [
            word
            for word in urgent_words
            if word in lower
        ]

        if hits:
            risks.append({
                "type": "Attention",
                "text": f"{message['name']}: {message['text']}",
                "level": "Medium"
            })

    for question in questions:
        risks.append({
            "type": "Open question",
            "text": question,
            "level": "Low"
        })

    if not actions:
        risks.append({
            "type": "Planning",
            "text": "No explicit action items were detected.",
            "level": "Low"
        })

    return risks[:8]


# =========================================================
# SUMMARY
# =========================================================

def build_summary(
    messages,
    topics,
    actions,
    decisions
):
    people = list(
        dict.fromkeys(
            message["name"]
            for message in messages
        )
    )

    if not messages:
        return "No conversation was found."

    parts = []

    parts.append(
        f"This conversation contains {len(messages)} messages "
        f"from {len(people)} participant"
        f"{'s' if len(people) != 1 else ''}."
    )

    if topics:
        topic_names = [
            topic["name"]
            for topic in topics[:3]
        ]

        parts.append(
            f"The main focus is {', '.join(topic_names)}."
        )

    if actions:
        parts.append(
            f"{len(actions)} actionable item"
            f"{'s' if len(actions) != 1 else ''} "
            f"were identified."
        )

    if decisions:
        parts.append(
            f"The group appears to have made "
            f"{len(decisions)} decision"
            f"{'s' if len(decisions) != 1 else ''}."
        )

    return " ".join(parts)


# =========================================================
# TIMELINE
# =========================================================

def build_timeline(
    messages,
    actions,
    decisions
):
    timeline = []

    for action in actions[:6]:
        timeline.append({
            "label": action["deadline"],
            "detail":
                f"{action['assignee']} → {action['task']}"
        })

    for decision in decisions[:4]:
        timeline.append({
            "label": "Decision",
            "detail": decision
        })

    if not timeline:
        for message in messages[:5]:
            timeline.append({
                "label": "Message",
                "detail":
                    f"{message['name']}: {message['text']}"
            })

    return timeline[:10]


# =========================================================
# MAIN LOCAL ANALYSIS
# =========================================================

def local_analysis(chat):
    messages = parse_messages(chat)

    word_count = sum(
        len(
            re.findall(
                r"\b[\w'-]+\b",
                message["text"]
            )
        )
        for message in messages
    )

    people = extract_people(messages)
    topics = detect_topics(messages)
    actions = extract_actions(messages)
    decisions = extract_decisions(messages)
    questions = extract_questions(messages)
    tone = sentiment(messages)
    collaboration = collaboration_analysis(messages)

    health = conversation_health(
        messages,
        actions,
        decisions,
        questions,
        collaboration
    )

    risks = risk_signals(
        messages,
        actions,
        questions
    )

    key_messages = extract_key_messages(messages)

    summary = build_summary(
        messages,
        topics,
        actions,
        decisions
    )

    timeline = build_timeline(
        messages,
        actions,
        decisions
    )

    most_active = (
        people[0]
        if people
        else {
            "name": "Unknown",
            "messages": 0,
            "share": 0,
            "role": "Unknown"
        }
    )

    insight = (
        f"{most_active['name']} is the most active participant "
        f"with {most_active['messages']} messages. "
        f"The conversation is {collaboration['label'].lower()}, "
        f"with {len(actions)} action item"
        f"{'s' if len(actions) != 1 else ''} and "
        f"{len(questions)} open question"
        f"{'s' if len(questions) != 1 else ''}."
    )

    return {
        "success": True,
        "source": "local-fallback",

        "message_count": len(messages),
        "word_count": word_count,
        "participant_count": len(people),

        "summary": summary,

        "tone": tone,

        "topics": topics,

        "actions": actions,

        "people": people,

        "decisions": decisions,

        "unresolved_questions": questions,

        "timeline": timeline,

        "key_messages": key_messages,

        "collaboration": collaboration,

        "health": health,

        "risks": risks,

        "most_active": most_active,

        "insight": insight,

        "privacy_note":
            "This analysis used the local GroupChat Decoder engine. No external AI provider was required."
    }


# =========================================================
# OPTIONAL OPENAI
# =========================================================

def openai_analysis(chat):
    use_openai = (
        os.getenv(
            "USE_OPENAI",
            "false"
        ).lower() == "true"
    )

    api_key = os.getenv(
        "OPENAI_API_KEY",
        ""
    ).strip()

    if not use_openai or not api_key:
        return None

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=api_key
        )

        system_prompt = """
You are GroupChat Decoder, an AI conversation intelligence system.

Analyze the supplied group conversation.

Return ONLY valid JSON with:

{
  "summary": "string",
  "tone": {
    "label": "Positive | Neutral | Balanced | Concerned",
    "score": 0,
    "explanation": "string"
  },
  "topics": [
    {"name": "string", "mentions": 1}
  ],
  "actions": [
    {
      "assignee": "string",
      "task": "string",
      "deadline": "string",
      "status": "Open"
    }
  ],
  "people": [
    {
      "name": "string",
      "role": "string",
      "messages": 1,
      "share": 0
    }
  ],
  "decisions": ["string"],
  "unresolved_questions": ["string"],
  "timeline": [
    {
      "label": "string",
      "detail": "string"
    }
  ],
  "key_messages": ["string"],
  "collaboration": {
    "score": 0,
    "label": "string",
    "description": "string"
  },
  "health": {
    "score": 0,
    "label": "string"
  },
  "risks": [
    {
      "type": "string",
      "text": "string",
      "level": "Low | Medium | High"
    }
  ],
  "insight": "string"
}

Never invent people, decisions, deadlines or tasks.
"""

        response = client.chat.completions.create(
            model=os.getenv(
                "OPENAI_MODEL",
                "gpt-4o-mini"
            ),
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": chat[:30000]
                }
            ],
            temperature=0.2
        )

        content = response.choices[0].message.content

        if not content:
            return None

        parsed = json.loads(content)

        messages = parse_messages(chat)

        parsed["success"] = True
        parsed["source"] = "openai"
        parsed["message_count"] = len(messages)
        parsed["word_count"] = len(
            re.findall(
                r"\b[\w'-]+\b",
                chat
            )
        )
        parsed["participant_count"] = len(
            set(
                message["name"]
                for message in messages
            )
        )
        parsed["privacy_note"] = (
            "OpenAI mode is enabled. Conversation content was sent to the configured AI provider."
        )

        return parsed

    except Exception:
        return None


# =========================================================
# ROUTES
# =========================================================

@app.get("/")
def home():
    return {
        "status": "online",
        "message":
            "GroupChat Decoder AI backend is running",
        "version": "3.0.0"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.post("/analyze")
def analyze_chat(data: dict):
    chat = data.get(
        "chat",
        ""
    )

    if not isinstance(chat, str) or not chat.strip():
        return {
            "success": False,
            "error":
                "No conversation provided."
        }

    ai_result = openai_analysis(chat)

    if ai_result:
        return ai_result

    return local_analysis(chat)