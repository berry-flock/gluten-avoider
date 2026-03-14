const backupFileInput = document.getElementById("backup-file-input");
const backupCsvContentInput = document.getElementById("backup-csv-content");

if (backupFileInput && backupCsvContentInput) {
  backupFileInput.addEventListener("change", async () => {
    const [file] = backupFileInput.files || [];

    if (!file) {
      backupCsvContentInput.value = "";
      return;
    }

    backupCsvContentInput.value = await file.text();
  });
}
