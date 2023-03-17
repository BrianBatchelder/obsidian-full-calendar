import { Calendar } from "./Calendar";

export abstract class LocalCalendar extends Calendar {
    /**
     * Directory where events for this calendar are stored.
     */
        abstract get directory(): string;
    
}
