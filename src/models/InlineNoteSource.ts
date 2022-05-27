import { EventSourceInput } from "@fullcalendar/core";
import { CacheItem, MetadataCache, Pos, TFile, TFolder, Vault } from "obsidian";
import { FCError, InlineCalendarSource } from "src/types";
import { EventSource } from "./EventSource";
import { InlineNoteEvent } from "./InlineNoteEvent";

export class InlineNoteSource extends EventSource {
	info: InlineCalendarSource;
	vault: Vault;
	cache: MetadataCache;

	constructor(
		vault: Vault,
		cache: MetadataCache,
		info: InlineCalendarSource
	) {
		super();
		this.vault = vault;
		this.cache = cache;
		this.info = info;
	}

	// TODO: This is O(n*m), but it can definitely be optimized to O(n).
	private extractText(content: string, positions: Pos[]): string[] {
		return positions
			.map((pos) => content.substring(pos.start.offset, pos.end.offset))
			.map((s) => s.replace(/\- (\[.\] ?)?/, ""));
	}

	async toApi(): Promise<EventSourceInput | FCError> {
		const directory = this.vault.getAbstractFileByPath(this.info.directory);
		if (directory === null) {
			return new FCError("Directory does not exist");
		}
		if (!(directory instanceof TFolder)) {
			return new FCError("Directory must be a directory");
		}
		const events: InlineNoteEvent[] = [];
		for (const file of directory.children) {
			if (!(file instanceof TFile)) {
				continue;
			}
			const data = this.cache.getFileCache(file);
			if (!data || !data.listItems) {
				continue;
			}

			events.push(
				...this.extractText(
					await this.vault.read(file),
					data.listItems.map((i) => i.position)
				)
					.map((text, idx) =>
						InlineNoteEvent.fromTextAndPosition(
							this.cache,
							this.vault,
							file,
							text,
							(data.listItems as CacheItem[])[idx].position
						)
					)
					.flatMap((evt) => (evt !== null ? [evt] : []))
			);
		}
		return {
			events: events.map((e) => e.toCalendarEvent()),
			textColor: getComputedStyle(document.body).getPropertyValue(
				"--text-on-accent"
			),
			color:
				this.info.color ||
				getComputedStyle(document.body).getPropertyValue(
					"--interactive-accent"
				),
		};
	}
}
