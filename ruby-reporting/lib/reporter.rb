require "tty-table"
require "pastel"
require "prawn"
require "prawn/table"
require "csv"

module DistributionOptimizer
  class Reporter
    PASTEL = Pastel.new

    def initialize(result)
      @result = result
    end

    def print_summary
      puts PASTEL.bold("Optimization Summary")
      puts "  Status:      #{@result[:status]}"
      puts "  Total cost:  #{format_currency(@result[:total_cost])}"
      puts "  Open DCs:    #{Array(@result[:open_dcs]).join(", ")}"
      puts "  Flows:       #{Array(@result[:flows]).size}"
      puts
      print_cost_breakdown
      print_flows
    end

    def print_cost_breakdown
      bd = @result[:cost_breakdown] || {}
      total = bd[:total].to_f
      table = TTY::Table.new(
        header: ["Component", "Cost", "% of Total"],
        rows: [
          ["DC operating",     format_currency(bd[:dc_operating]),           pct(bd[:dc_operating], total)],
          ["Plant -> DC",      format_currency(bd[:plant_to_dc_shipping]),   pct(bd[:plant_to_dc_shipping], total)],
          ["DC -> Retailer",   format_currency(bd[:dc_to_retailer_shipping]), pct(bd[:dc_to_retailer_shipping], total)],
          [PASTEL.bold("TOTAL"), PASTEL.bold(format_currency(total)), "100%"]
        ]
      )
      puts table.render(:unicode, padding: [0, 1])
    end

    def print_flows
      flows = Array(@result[:flows])
      return if flows.empty?
      table = TTY::Table.new(
        header: ["From", "To", "Mode", "Units", "Cost"],
        rows: flows.map { |f|
          [f[:from], f[:to], f[:mode], f[:units].to_f.round(1), format_currency(f[:cost])]
        }
      )
      puts table.render(:unicode, padding: [0, 1])
    end

    def export_csv(path)
      FileUtils.mkdir_p(File.dirname(path)) if defined?(FileUtils)
      Dir.mkdir(File.dirname(path)) unless Dir.exist?(File.dirname(path))
      CSV.open(path, "w") do |csv|
        csv << ["Status", @result[:status]]
        csv << ["Total Cost", @result[:total_cost]]
        csv << []
        csv << ["Open DCs"]
        Array(@result[:open_dcs]).each { |dc| csv << [dc] }
        csv << []
        csv << ["From", "To", "Mode", "Units", "Cost"]
        Array(@result[:flows]).each do |f|
          csv << [f[:from], f[:to], f[:mode], f[:units], f[:cost]]
        end
      end
    end

    def export_pdf(path)
      Dir.mkdir(File.dirname(path)) unless Dir.exist?(File.dirname(path))
      Prawn::Document.generate(path, page_size: "A4", margin: 40) do |pdf|
        pdf.font_size(18) { pdf.text("Optimization Report", style: :bold) }
        pdf.move_down(12)
        pdf.text("Status: #{@result[:status]}")
        pdf.text("Total Cost: #{format_currency(@result[:total_cost])}")
        pdf.move_down(8)
        pdf.text("Open DCs: #{Array(@result[:open_dcs]).join(", ")}")
        pdf.move_down(12)
        flows = Array(@result[:flows])
        if flows.any?
          rows = [["From", "To", "Mode", "Units", "Cost"]] + flows.map { |f|
            [f[:from], f[:to], f[:mode], f[:units].to_f.round(1).to_s, format_currency(f[:cost])]
          }
          pdf.table(rows, header: true)
        end
      end
    end

    private

    def format_currency(val)
      "$#{format('%.2f', val.to_f)}"
    end

    def pct(val, total)
      return "0.0%" if total.to_f.zero?
      "#{(val.to_f / total.to_f * 100).round(1)}%"
    end
  end
end
