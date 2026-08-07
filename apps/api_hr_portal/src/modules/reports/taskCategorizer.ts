export type TaskCategory = 
  | "HR Meeting" 
  | "HR Activity" 
  | "IT Sync" 
  | "IT Support" 
  | "General Meeting" 
  | "Development" 
  | "Travel" 
  | "BAU"
  | "Lunch"
  | "Other";

export function inferTaskCategory(description?: string, fallbackType?: string): TaskCategory {
  if (!description) {
    if (fallbackType?.toLowerCase() === "lunch") return "Lunch";
    return "BAU";
  }

  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes("hr") && (lowerDesc.includes("meet") || lowerDesc.includes("sync") || lowerDesc.includes("catch up"))) return "HR Meeting";
  if (lowerDesc.includes("hr")) return "HR Activity";
  if (lowerDesc.includes("it") && (lowerDesc.includes("sync") || lowerDesc.includes("meet"))) return "IT Sync";
  if (lowerDesc.includes("it") || lowerDesc.includes("support") || lowerDesc.includes("help") || lowerDesc.includes("ticket")) return "IT Support";
  if (lowerDesc.includes("meet") || lowerDesc.includes("sync") || lowerDesc.includes("catch up") || lowerDesc.includes("1:1") || lowerDesc.includes("1 on 1")) return "General Meeting";
  if (lowerDesc.includes("dev") || lowerDesc.includes("code") || lowerDesc.includes("build") || lowerDesc.includes("fix") || lowerDesc.includes("pr") || lowerDesc.includes("test")) return "Development";
  if (lowerDesc.includes("travel") || lowerDesc.includes("flight") || lowerDesc.includes("transit") || lowerDesc.includes("drive") || lowerDesc.includes("commute")) return "Travel";
  
  if (fallbackType?.toLowerCase() === "lunch") return "Lunch";

  return "BAU";
}
