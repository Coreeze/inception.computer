"""
Inception Fine-Tuning Dataset Builder
====================================
Takes nvidia/Nemotron-Personas-USA and formats it for SFT training
on Mistral-7B to generate believable AI people.

Usage:
    pip install datasets
    python build_finetune_dataset.py

Output:
    inception_personas_train.jsonl  (ready for Unsloth/TRL)
"""

import json
import random
from datasets import load_dataset

# ── Config ──────────────────────────────────────────────────────────
SAMPLE_SIZE = 50_000       # start with 50K, scale up if quality is good
OUTPUT_FILE = "inception_personas_train.jsonl"
SEED = 42

# ── Prompt templates (variety prevents the model from overfitting to one format) ──
GENERATION_PROMPTS = [
    "Generate a realistic persona for a life simulation.",
    "Create a detailed character profile for a simulated person.",
    "Design a believable AI person with a complete background.",
    "Generate a new NPC persona with demographics, personality, and goals.",
    "Create a lifelike character with interests, skills, and ambitions.",
]

CONDITIONAL_PROMPTS = [
    "Generate a realistic persona for a {age}-year-old {sex} living in {city}, {state}.",
    "Create a character profile: {sex}, age {age}, {occupation} in {city}, {state}.",
    "Design a persona for someone who is {age}, {marital_status}, working as a {occupation}.",
    "Generate a believable person: {sex}, {age} years old, {education_level} education, based in {city}, {state}.",
]

# ── Format a single persona into the training target ──────────────
def format_persona_output(row: dict) -> str:
    """Formats a Nemotron persona record into a rich character profile."""
    
    lines = []
    
    # Demographics block
    lines.append(f"## Demographics")
    lines.append(f"Sex: {row['sex']}")
    lines.append(f"Age: {row['age']}")
    lines.append(f"Location: {row['city']}, {row['state']} {row['zipcode']}")
    lines.append(f"Marital Status: {row['marital_status'].replace('_', ' ').title()}")
    lines.append(f"Education: {row['education_level'].replace('_', ' ').title()}")
    if row.get('bachelors_field') and row['bachelors_field'].strip():
        lines.append(f"Field of Study: {row['bachelors_field'].upper()}")
    lines.append(f"Occupation: {row['occupation'].replace('_', ' ').title()}")
    
    # Personality & Identity
    lines.append(f"\n## Personality")
    lines.append(row['persona'])
    
    # Cultural Background
    lines.append(f"\n## Background")
    lines.append(row['cultural_background'])
    
    # Professional
    lines.append(f"\n## Professional Life")
    lines.append(row['professional_persona'])
    
    # Skills
    lines.append(f"\n## Skills & Expertise")
    lines.append(row['skills_and_expertise'])
    
    # Hobbies
    lines.append(f"\n## Hobbies & Interests")
    lines.append(row['hobbies_and_interests'])
    
    # Goals
    lines.append(f"\n## Life Goals")
    lines.append(row['career_goals_and_ambitions'])
    
    # Lifestyle facets
    lines.append(f"\n## Sports & Fitness")
    lines.append(row['sports_persona'])
    
    lines.append(f"\n## Arts & Culture")
    lines.append(row['arts_persona'])
    
    lines.append(f"\n## Travel")
    lines.append(row['travel_persona'])
    
    lines.append(f"\n## Food & Cooking")
    lines.append(row['culinary_persona'])
    
    return "\n".join(lines)


def build_training_example(row: dict, rng: random.Random) -> dict:
    """Creates one training example in Mistral instruct format."""
    
    persona_text = format_persona_output(row)
    
    # 50% unconditional, 50% conditional (with demographic hints)
    if rng.random() < 0.5:
        prompt = rng.choice(GENERATION_PROMPTS)
    else:
        template = rng.choice(CONDITIONAL_PROMPTS)
        prompt = template.format(
            age=row['age'],
            sex=row['sex'],
            city=row['city'],
            state=row['state'],
            occupation=row['occupation'].replace('_', ' ').title(),
            marital_status=row['marital_status'].replace('_', ' '),
            education_level=row['education_level'].replace('_', ' '),
        )
    
    # Mistral instruct format
    text = f"<s>[INST] {prompt} [/INST]\n{persona_text}</s>"
    
    # Also save structured for ChatML / other formats
    return {
        "text": text,
        "messages": [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": persona_text},
        ],
    }


def main():
    print(f"Loading nvidia/Nemotron-Personas-USA...")
    ds = load_dataset("nvidia/Nemotron-Personas-USA", split="train")
    
    print(f"Total records: {len(ds):,}")
    print(f"Sampling {SAMPLE_SIZE:,} records...")
    
    rng = random.Random(SEED)
    indices = rng.sample(range(len(ds)), min(SAMPLE_SIZE, len(ds)))
    
    print(f"Building training examples...")
    examples = []
    for i, idx in enumerate(indices):
        row = ds[idx]
        example = build_training_example(row, rng)
        examples.append(example)
        if (i + 1) % 10_000 == 0:
            print(f"  Processed {i+1:,}/{SAMPLE_SIZE:,}")
    
    # Write JSONL
    print(f"Writing {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w") as f:
        for ex in examples:
            f.write(json.dumps(ex) + "\n")
    
    # Stats
    avg_len = sum(len(ex["text"]) for ex in examples) / len(examples)
    print(f"\nDone!")
    print(f"  Examples: {len(examples):,}")
    print(f"  Avg length: {avg_len:,.0f} chars")
    print(f"  Output: {OUTPUT_FILE}")
    
    # Preview
    print(f"\n{'='*60}")
    print(f"SAMPLE OUTPUT:")
    print(f"{'='*60}")
    print(examples[0]["text"][:2000])
    print("...")


if __name__ == "__main__":
    main()
