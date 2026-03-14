import { NextResponse } from "next/server";
import {
  loadPerspectiveDecksIndex,
  getDomainDisplayName,
  getDomainDescription,
} from "@/lib/perspective-decks";
import { isValidLanguageCode } from "@/lib/languages";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language");
    const lang = language && isValidLanguageCode(language) ? language : undefined;
    const index = loadPerspectiveDecksIndex(lang);
    const decks = index.decks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      domain: d.domain,
      subdomain_id: d.subdomain_id,
      subdomain_name: d.subdomain_name,
    }));
    const domainIds = [...new Set(decks.map((d) => (d.domain || "").toLowerCase()).filter(Boolean))];
    const domains = Object.fromEntries(
      domainIds.map((id) => [
        id,
        {
          name: getDomainDisplayName(index.domains, id),
          description: getDomainDescription(index.domains, id),
        },
      ])
    );
    const subdomainsByDomain: Record<string, { id: string; name: string; deck_id: string }[]> = {};
    for (const d of decks) {
      if (d.subdomain_id && d.subdomain_name && d.domain) {
        const domain = d.domain.toLowerCase();
        if (!subdomainsByDomain[domain]) subdomainsByDomain[domain] = [];
        subdomainsByDomain[domain].push({
          id: d.subdomain_id,
          name: d.subdomain_name,
          deck_id: d.id,
        });
      }
    }
    return NextResponse.json({ decks, domains, subdomainsByDomain });
  } catch (err) {
    console.error("Failed to list perspective decks:", err);
    return NextResponse.json(
      { error: "Failed to list perspective decks" },
      { status: 500 }
    );
  }
}
