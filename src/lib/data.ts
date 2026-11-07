import type { Listing, Review, Student, StudentProfile, Thread } from "./types";

import imgCamera from "@/assets/listing-camera.jpg";
import imgChemNotes from "@/assets/listing-chem-notes.jpg";
import imgCoding from "@/assets/listing-coding.jpg";
import imgTickets from "@/assets/listing-tickets.jpg";
import imgBike from "@/assets/listing-bike.jpg";
import imgHeadphones from "@/assets/listing-headphones.jpg";
import imgCalculator from "@/assets/listing-calculator.jpg";
import imgLamp from "@/assets/listing-lamp.jpg";
import imgGuitar from "@/assets/listing-guitar.jpg";
import imgDrafting from "@/assets/listing-drafting.jpg";
import imgStatsBook from "@/assets/listing-stats-book.jpg";

import { getCachedProfile, getDepartmentColor, getInitials } from "./auth";

export const aishwaryaDemoUser: Student = {
  id: "u0",
  name: "Aishwarya Rai",
  initials: "AR",
  color: "#6366f1",
  department: "Computer Science",
  year: "Year 3",
  rating: 4.9,
  exchanges: 18,
  joined: "Sep 2024",
  bio: "CS junior who trades more than she buys. Into photography, hackathons, and keeping good gear in circulation. North Campus, usually near the ACM lab.",
};

export const currentUser: Student = aishwaryaDemoUser;

export const students: Student[] = [
  aishwaryaDemoUser,
  {
    id: "u1",
    name: "Marcus Lee",
    initials: "ML",
    color: "#0ea5e9",
    department: "Media Arts",
    year: "Year 3",
    rating: 4.8,
    exchanges: 21,
    joined: "Jan 2024",
    bio: "Film minor, camera nerd. Always swapping gear.",
  },
  {
    id: "u2",
    name: "Jasmine Wu",
    initials: "JW",
    color: "#10b981",
    department: "Chemistry",
    year: "Graduated",
    rating: 4.9,
    exchanges: 34,
    joined: "Sep 2021",
    bio: "Alum clearing out four years of perfectly organized notes.",
  },
  {
    id: "u3",
    name: "David Kim",
    initials: "DK",
    color: "#f59e0b",
    department: "Computer Science",
    year: "Year 4",
    rating: 5.0,
    exchanges: 30,
    joined: "Sep 2022",
    bio: "TA for the web dev course. Happy to un-block your project.",
  },
  {
    id: "u4",
    name: "Elena Garcia",
    initials: "EG",
    color: "#ec4899",
    department: "Business",
    year: "Year 2",
    rating: 4.7,
    exchanges: 9,
    joined: "Sep 2024",
    bio: "Event committee member — I always know where the tickets are.",
  },
  {
    id: "u5",
    name: "Toby Reynolds",
    initials: "TR",
    color: "#8b5cf6",
    department: "Mechanical Eng",
    year: "Year 2",
    rating: 4.6,
    exchanges: 12,
    joined: "Sep 2024",
    bio: "Cycling club. Fixing bikes, borrowing bikes, talking bikes.",
  },
  {
    id: "u6",
    name: "Priya Nair",
    initials: "PN",
    color: "#14b8a6",
    department: "Electrical Eng",
    year: "Year 4",
    rating: 4.8,
    exchanges: 26,
    joined: "Sep 2022",
    bio: "EEE senior. My bookshelf is your bookshelf.",
  },
  {
    id: "u7",
    name: "Sofia Chen",
    initials: "SC",
    color: "#f97316",
    department: "Architecture",
    year: "Year 3",
    rating: 4.9,
    exchanges: 15,
    joined: "Jan 2023",
    bio: "Studio rat. Trading drafting tools and late-night playlists.",
  },
  {
    id: "u8",
    name: "Jordan Blake",
    initials: "JB",
    color: "#84cc16",
    department: "Music",
    year: "Year 1",
    rating: 4.5,
    exchanges: 6,
    joined: "Sep 2025",
    bio: "First-year, too many instruments, not enough dorm space.",
  },
  {
    id: "u9",
    name: "Sam Okafor",
    initials: "SO",
    color: "#ef4444",
    department: "Mathematics",
    year: "Year 5",
    rating: 5.0,
    exchanges: 41,
    joined: "Sep 2021",
    bio: "Math grad student. Tutored half the campus at this point.",
  },
];

export function getStudent(
  id: string,
  activeProfile?: StudentProfile | null,
  fallbackListing?: Partial<Listing> | null,
  allListings?: Listing[] | null,
): Student {
  if (activeProfile && (activeProfile.id === id || activeProfile.uid === id)) {
    return activeProfile;
  }
  const cached = getCachedProfile(id);
  if (cached) return cached;
  const found = students.find((s) => s.id === id);
  if (found) return found;

  // Only use fallbackListing's owner info if this student is actually the listing owner
  const isListingOwner = Boolean(fallbackListing && fallbackListing.ownerId === id);
  let ownerName = isListingOwner ? fallbackListing?.ownerName?.trim() : undefined;
  let ownerInitials = isListingOwner ? fallbackListing?.ownerInitials?.trim() : undefined;
  let department = isListingOwner ? fallbackListing?.department?.trim() : undefined;
  let year = isListingOwner ? fallbackListing?.year?.trim() : undefined;

  // If not the owner of this specific listing, check if they own any other listing in allListings
  if (!ownerName && allListings && allListings.length > 0) {
    const userListing = allListings.find((l) => l.ownerId === id && l.ownerName?.trim());
    if (userListing) {
      ownerName = userListing.ownerName?.trim();
      ownerInitials = userListing.ownerInitials?.trim();
      department = userListing.department?.trim();
      year = userListing.year?.trim();
    }
  }

  const dept = department || "Student Community";
  const finalYear = year || "Undergrad";

  return {
    id,
    name: ownerName || "Campus Student",
    initials: ownerInitials || (ownerName ? getInitials(ownerName) : "CS"),
    color: getDepartmentColor(dept),
    department: dept,
    year: finalYear,
    rating: 0,
    exchanges: 0,
    joined: "Recently",
    bio: "Student on REXchange marketplace.",
  };
}

export const seedListings: Listing[] = [];

export const seedThreads: Thread[] = [];

export const seedReviews: Review[] = [];

export const imagePool: { src: string; label: string }[] = [
  { src: imgCamera, label: "Camera" },
  { src: imgChemNotes, label: "Textbooks & notes" },
  { src: imgCoding, label: "Coding setup" },
  { src: imgTickets, label: "Event tickets" },
  { src: imgBike, label: "Bicycle" },
  { src: imgHeadphones, label: "Headphones" },
  { src: imgCalculator, label: "Calculator" },
  { src: imgLamp, label: "Desk lamp" },
  { src: imgGuitar, label: "Guitar" },
  { src: imgDrafting, label: "Drafting kit" },
  { src: imgStatsBook, label: "Textbook" },
];

export function timeAgo(hours: number): string {
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
