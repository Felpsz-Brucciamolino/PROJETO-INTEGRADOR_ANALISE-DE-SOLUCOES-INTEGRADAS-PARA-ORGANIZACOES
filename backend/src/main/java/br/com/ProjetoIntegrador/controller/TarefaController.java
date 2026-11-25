package br.com.ProjetoIntegrador.controller;

import br.com.ProjetoIntegrador.entity.Evidencia;
import br.com.ProjetoIntegrador.entity.Tarefa;
import br.com.ProjetoIntegrador.repository.EvidenciaRepository;
import br.com.ProjetoIntegrador.repository.TarefaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/tarefas")
@CrossOrigin(origins = "*")
public class TarefaController {

    @Autowired
    private TarefaRepository repository;

    @Autowired
    private EvidenciaRepository evidenciaRepository;

    private static final String UPLOAD_DIR = "uploads/";

    @GetMapping
    public List<Tarefa> listar() {
        return repository.findAll();
    }

    @PostMapping
    public Tarefa criar(@RequestBody Tarefa tarefa) {
        return repository.save(tarefa);
    }

    @PutMapping("/{id}")
    public Tarefa atualizar(@PathVariable Long id, @RequestBody Tarefa tarefa) {
        tarefa.setId(id);
        return repository.save(tarefa);
    }

    @DeleteMapping("/{id}")
    public void deletar(@PathVariable Long id) {
        repository.deleteById(id);
    }

    @GetMapping("/evidencias/{id}")
    public ResponseEntity<?> buscarEvidencia(@PathVariable Long id) {
        Evidencia evidencia = evidenciaRepository.findById(id).orElse(null);
        if (evidencia == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            Path path = Paths.get(evidencia.getCaminhoArquivo());
            if (!Files.exists(path)) {
                return ResponseEntity.notFound().build();
            }

            byte[] bytes = Files.readAllBytes(path);
            String tipo = evidencia.getTipo() != null && !evidencia.getTipo().isBlank() 
                    ? evidencia.getTipo() 
                    : "image/jpeg";

            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, tipo)
                    .body(bytes);
        } catch (IOException e) {
            return ResponseEntity.status(500).body("Erro ao ler arquivo: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/evidencias")
    public ResponseEntity<?> uploadEvidencia(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        Tarefa tarefa = repository.findById(id).orElse(null);
        if (tarefa == null) {
            return ResponseEntity.status(404).body("Tarefa não encontrada");
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Arquivo vazio");
        }

        try {
            File uploadDir = new File(UPLOAD_DIR);
            if (!uploadDir.exists()) {
                uploadDir.mkdirs();
            }

            String filename = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
            Path filePath = Paths.get(UPLOAD_DIR + filename);
            Files.write(filePath, file.getBytes());

            Evidencia evidencia = new Evidencia();
            evidencia.setNomeArquivo(file.getOriginalFilename());
            evidencia.setCaminhoArquivo(filePath.toString());
            evidencia.setTipo(file.getContentType());
            evidencia.setTarefa(tarefa);

            evidenciaRepository.save(evidencia);

            return ResponseEntity.ok(evidencia);
        } catch (IOException e) {
            return ResponseEntity.status(500).body("Erro ao salvar arquivo: " + e.getMessage());
        }
    }
}
