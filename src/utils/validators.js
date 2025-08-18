export function validateResponseAgainstForm(form, answers) {
  const map = new Map(form.questions.map((q) => [q.id, q]));
  const errors = [];

  // required checks
  for (const q of form.questions) {
    if (!q.required) continue;
    const a = answers.find((x) => x.questionId === q.id);
    if (!a) {
      errors.push(`Missing required: ${q.label}`);
      continue;
    }
    if (q.type === "checkboxes") {
      if (!Array.isArray(a.value) || a.value.length === 0) {
        errors.push(`Empty required (checkboxes): ${q.label}`);
      }
    } else if (a.value === null || a.value === undefined || a.value === "") {
      errors.push(`Empty required: ${q.label}`);
    }
  }

  // type checks
  for (const a of answers) {
    const q = map.get(a.questionId);
    if (!q) continue;

    switch (q.type) {
      case "number": {
        const n = Number(a.value);
        if (Number.isNaN(n)) errors.push(`Expected number: ${q.label}`);
        if (q.min != null && n < q.min) errors.push(`Min ${q.min}: ${q.label}`);
        if (q.max != null && n > q.max) errors.push(`Max ${q.max}: ${q.label}`);
        break;
      }
      case "multiple_choice":
      case "dropdown": {
        if (q.options?.length && !q.options.includes(a.value)) {
          errors.push(`Invalid option for: ${q.label}`);
        }
        break;
      }
      case "checkboxes": {
        if (!Array.isArray(a.value)) {
          errors.push(`Expected array for checkboxes: ${q.label}`);
        } else {
          const invalid = (a.value || []).some((v) => !q.options?.includes(v));
          if (invalid) errors.push(`Invalid checkbox option: ${q.label}`);
        }
        break;
      }
      case "rating": {
        const n = Number(a.value);
        if (Number.isNaN(n)) errors.push(`Expected rating number: ${q.label}`);
        if (q.min != null && n < q.min) errors.push(`Min ${q.min}: ${q.label}`);
        if (q.max != null && n > q.max) errors.push(`Max ${q.max}: ${q.label}`);
        break;
      }
      default:
        break;
    }
  }

  return errors;
}
