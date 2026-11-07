#include <cctype>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

struct Json {
    using Object = std::map<std::string, Json>;
    using Array = std::vector<Json>;
    std::variant<std::nullptr_t, bool, double, std::string, Object, Array> value;
};

class Parser {
public:
    explicit Parser(std::string input) : input_(std::move(input)) {}
    Json parse() {
        Json result = value();
        whitespace();
        if (pos_ != input_.size()) fail("unexpected content after JSON value");
        return result;
    }
private:
    std::string input_;
    std::size_t pos_ = 0;
    [[noreturn]] void fail(const std::string& message) const {
        throw std::runtime_error("JSON at byte " + std::to_string(pos_) + ": " + message);
    }
    void whitespace() {
        while (pos_ < input_.size() && std::isspace(static_cast<unsigned char>(input_[pos_]))) ++pos_;
    }
    bool take(char c) {
        whitespace();
        if (pos_ < input_.size() && input_[pos_] == c) { ++pos_; return true; }
        return false;
    }
    std::string string() {
        whitespace();
        if (pos_ >= input_.size() || input_[pos_++] != '"') fail("expected string");
        std::string out;
        while (pos_ < input_.size()) {
            char c = input_[pos_++];
            if (c == '"') return out;
            if (static_cast<unsigned char>(c) < 0x20) fail("control character in string");
            if (c != '\\') { out += c; continue; }
            if (pos_ >= input_.size()) fail("unfinished escape");
            char e = input_[pos_++];
            switch (e) {
                case '"': out += '"'; break; case '\\': out += '\\'; break;
                case '/': out += '/'; break; case 'b': out += '\b'; break;
                case 'f': out += '\f'; break; case 'n': out += '\n'; break;
                case 'r': out += '\r'; break; case 't': out += '\t'; break;
                case 'u': {
                    if (pos_ + 4 > input_.size()) fail("short unicode escape");
                    for (int i = 0; i < 4; ++i)
                        if (!std::isxdigit(static_cast<unsigned char>(input_[pos_++]))) fail("invalid unicode escape");
                    out += '?';
                    break;
                }
                default: fail("invalid string escape");
            }
        }
        fail("unterminated string");
    }
    Json value() {
        whitespace();
        if (pos_ >= input_.size()) fail("expected value");
        if (input_[pos_] == '"') return Json{string()};
        if (take('{')) {
            Json::Object object;
            if (take('}')) return Json{object};
            do {
                std::string key = string();
                if (!take(':')) fail("expected ':'");
                if (!object.emplace(key, value()).second) fail("duplicate object key '" + key + "'");
            } while (take(','));
            if (!take('}')) fail("expected '}'");
            return Json{object};
        }
        if (take('[')) {
            Json::Array array;
            if (take(']')) return Json{array};
            do { array.push_back(value()); } while (take(','));
            if (!take(']')) fail("expected ']'");
            return Json{array};
        }
        auto literal = [&](const std::string& word, Json result) {
            if (input_.compare(pos_, word.size(), word) == 0) { pos_ += word.size(); return result; }
            fail("invalid value");
        };
        if (input_[pos_] == 't') return literal("true", Json{true});
        if (input_[pos_] == 'f') return literal("false", Json{false});
        if (input_[pos_] == 'n') return literal("null", Json{nullptr});
        std::size_t start = pos_;
        if (input_[pos_] == '-') ++pos_;
        while (pos_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) ++pos_;
        if (pos_ < input_.size() && input_[pos_] == '.') {
            ++pos_; while (pos_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) ++pos_;
        }
        if (start == pos_) fail("invalid value");
        try { return Json{std::stod(input_.substr(start, pos_ - start))}; }
        catch (...) { fail("invalid number"); }
    }
};

static bool valid_name(const std::string& s) {
    if (s.empty() || s.size() > 64 || s.front() == '-' || s.back() == '-') return false;
    bool previous_dash = false;
    for (unsigned char c : s) {
        if (c == '-') { if (previous_dash) return false; previous_dash = true; }
        else if (std::islower(c) || std::isdigit(c)) previous_dash = false;
        else return false;
    }
    return true;
}
static bool valid_version(const std::string& s) {
    std::size_t i = 0;
    for (int part = 0; part < 3; ++part) {
        std::size_t start = i;
        while (i < s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) ++i;
        if (start == i || (i - start > 1 && s[start] == '0')) return false;
        if (part < 2) { if (i >= s.size() || s[i++] != '.') return false; }
    }
    if (i < s.size() && s[i] == '-') {
        ++i; std::size_t start = i;
        while (i < s.size() && (std::isalnum(static_cast<unsigned char>(s[i])) || s[i] == '.' || s[i] == '-')) ++i;
        if (i == start) return false;
    }
    return i == s.size();
}
static bool safe_entry(const std::string& entry) {
    if (entry.empty()) return false;
    std::filesystem::path p(entry);
    if (p.is_absolute() || p.has_root_name()) return false;
    for (const auto& part : p) if (part == "..") return false;
    return p.extension() == ".vtr";
}
static const std::string* get_string(const Json::Object& obj, const std::string& key) {
    auto it = obj.find(key);
    return it == obj.end() ? nullptr : std::get_if<std::string>(&it->second.value);
}
static int validate_manifest(const std::filesystem::path& path) {
    std::ifstream file(path, std::ios::binary);
    if (!file) throw std::runtime_error("cannot open manifest: " + path.string());
    std::ostringstream buffer; buffer << file.rdbuf();
    Json root = Parser(buffer.str()).parse();
    auto* object = std::get_if<Json::Object>(&root.value);
    if (!object) throw std::runtime_error("manifest root must be a JSON object");
    const auto* name = get_string(*object, "name");
    const auto* version = get_string(*object, "version");
    const auto* entry = get_string(*object, "entry");
    const auto* description = get_string(*object, "description");
    if (!name || !valid_name(*name)) throw std::runtime_error("invalid package name");
    if (!version || !valid_version(*version)) throw std::runtime_error("version must use MAJOR.MINOR.PATCH format");
    if (!entry || !safe_entry(*entry)) throw std::runtime_error("entry must be a safe relative .vtr path");
    if (description && description->size() > 500) throw std::runtime_error("description must be 500 characters or fewer");
    auto deps = object->find("dependencies");
    if (deps != object->end()) {
        auto* map = std::get_if<Json::Object>(&deps->second.value);
        if (!map) throw std::runtime_error("dependencies must be an object");
        for (const auto& [dep_name, dep_version] : *map) {
            auto* v = std::get_if<std::string>(&dep_version.value);
            if (!valid_name(dep_name) || !v || !valid_version(*v))
                throw std::runtime_error("invalid dependency: " + dep_name);
        }
    }
    std::cout << "Valid Veter package manifest: " << *name << "@" << *version << "\n";
    return 0;
}
static void write_file(const std::filesystem::path& path, const std::string& data) {
    std::ofstream out(path, std::ios::binary);
    if (!out) throw std::runtime_error("cannot create file: " + path.string());
    out << data;
    if (!out) throw std::runtime_error("cannot write file: " + path.string());
}
static int create_project(const std::string& name) {
    if (!valid_name(name)) throw std::runtime_error("project name must use lowercase letters, numbers, and single hyphens");
    std::filesystem::path root(name);
    if (std::filesystem::exists(root)) throw std::runtime_error("destination already exists: " + name);
    try {
        if (!std::filesystem::create_directory(root)) throw std::runtime_error("could not create project directory");
        std::filesystem::create_directory(root / "src");
        write_file(root / "veter.package.json",
            "{\n  \"name\": \"" + name + "\",\n  \"version\": \"0.1.0\",\n  \"description\": \"A new Veter project\",\n  \"entry\": \"src/main.vtr\",\n  \"dependencies\": {}\n}\n");
        write_file(root / "src" / "main.vtr", "# My first Veter program\ndisplay \"Hello from Veter!\"\n");
        write_file(root / "README.md", "# " + name + "\n\nA new Veter project.\n\nEdit src/main.vtr to start coding.\n");
    } catch (...) {
        std::error_code ignored;
        std::filesystem::remove_all(root, ignored);
        throw;
    }
    std::cout << "Created Veter project: " << name << "\n";
    std::cout << "Next: cd " << name << " and edit src/main.vtr\n";
    return 0;
}
int main(int argc, char** argv) {
    if (argc == 3 && std::string(argv[1]) == "new") {
        try { return create_project(argv[2]); }
        catch (const std::exception& e) { std::cerr << "Project error: " << e.what() << "\n"; return 1; }
    }
    if (argc == 3 && std::string(argv[1]) == "validate") {
        try { return validate_manifest(argv[2]); }
        catch (const std::exception& e) { std::cerr << "Manifest error: " << e.what() << "\n"; return 1; }
    }
    std::cerr << "Usage:\n  veter-pkg new <project-name>\n  veter-pkg validate <veter.package.json>\n";
    return 2;
}
