export function splitCustomerName(value) {
    const [firstName = "", ...lastNameParts] = String(value || "").trim().split(/\s+/);
    return { firstName, lastName: lastNameParts.join(" ") };
}

export function normalizeCustomerName({ firstName, lastName, name } = {}) {
    const parts = firstName === undefined && lastName === undefined
        ? splitCustomerName(name)
        : { firstName: String(firstName || "").trim(), lastName: String(lastName || "").trim() };
    const normalizedFirstName = parts.firstName.slice(0, 60);
    const normalizedLastName = parts.lastName.slice(0, 60);
    const fullName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");

    if (!normalizedFirstName || !normalizedLastName || fullName.length > 120) {
        throw new Error("Enter your first and last name.");
    }

    return { firstName: normalizedFirstName, lastName: normalizedLastName, name: fullName };
}
