"use client";

import { CharacterCreator } from "@/modules/character/components/character-creator";

// The home of the Character section is the creator itself (not a list): pick every piece and see the result in the middle.
export default function Page() {
  return <CharacterCreator />;
}
